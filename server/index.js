const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const session = require('express-session');
const { generateAIResponse, regenerateCoverLetter } = require('./services/gpt');
const { processResumePDF } = require('./services/pdfProcessor');

dotenv.config();
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'))
app.use(express.static(path.join(__dirname, '../client')));

// Session middleware for storing analysis data
app.use(session({
  secret: process.env.SESSION_SECRET || 'jobpilot-ai-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const upload = multer({ 
  dest: 'public/uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Enhanced job description extraction with multiple methods
async function extractJobDescriptionFromURL(url) {
  console.log('🌐 Extracting job description from:', url);
  
  try {
    // Add headers to mimic a real browser
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000, // 10 second timeout
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share').remove();
    
    // Try multiple selectors to find job content
    const selectors = [
      '.job-description',
      '.job-details',
      '.job-content',
      '.description',
      '.posting-description',
      '.job-posting',
      '[data-testid="job-description"]',
      '.job-summary',
      'main',
      'article',
      '.content'
    ];
    
    let jobText = '';
    
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        jobText = element.text();
        if (jobText.length > 200) {
          console.log(`✅ Found job content using selector: ${selector}`);
          break;
        }
      }
    }
    
    // Fallback to body if no specific selectors worked
    if (!jobText || jobText.length < 200) {
      console.log('🔄 Using fallback to body content');
      jobText = $('body').text();
    }
    
    // Clean up the text
    const cleanedText = jobText
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      .trim();
    
    if (cleanedText.length < 100) {
      console.error('❌ Extracted job description too short');
      return null;
    }
    
    // Limit to reasonable length (first 4000 chars to avoid token limits)
    const finalText = cleanedText.slice(0, 4000);
    console.log(`✅ Job description extracted: ${finalText.length} characters`);
    
    return finalText;
    
  } catch (err) {
    console.error('❌ Job description extraction failed:', err.message);
    
    // Provide specific error messages
    if (err.code === 'ENOTFOUND') {
      console.error('   DNS resolution failed - URL might be invalid');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('   Connection refused - server might be down');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('   Request timed out - server too slow to respond');
    } else if (err.response && err.response.status) {
      console.error(`   HTTP ${err.response.status}: ${err.response.statusText}`);
    }
    
    return null;
  }
}

app.post('/analyze', upload.single('resume'), async (req, res) => {
  console.log('📝 Analysis request received');
  console.log('📁 File info:', req.file);
  console.log('🔗 Job URL:', req.body.jobUrl);

  const jobUrl = req.body.jobUrl;
  const resumeFile = req.file;

  // Enhanced validation
  if (!resumeFile) {
    console.error('❌ No file uploaded');
    return res.status(400).json({ 
      error: 'No resume file uploaded. Please select a PDF file.' 
    });
  }

  if (!jobUrl) {
    console.error('❌ No job URL provided');
    return res.status(400).json({ 
      error: 'Job URL is required. Please provide a valid job posting URL.' 
    });
  }

  // Check if file exists and is readable
  if (!fs.existsSync(resumeFile.path)) {
    console.error('❌ Uploaded file not found:', resumeFile.path);
    return res.status(500).json({ 
      error: 'Uploaded file could not be processed. Please try uploading again.' 
    });  }  try {
    console.log('📖 Processing PDF file with simplified extractor...');
    
    // Use our new all-in-one function
    const pdfResult = await processResumePDF(resumeFile.path);
    
    // Check if processing was successful
    if (!pdfResult.success) {
      console.error('❌ PDF processing failed');
      return res.status(400).json({ 
        error: 'PDF processing failed. Please try a different PDF file.' 
      });
    }

    // Check validation results (but be lenient)
    if (!pdfResult.validation.isValid) {
      console.warn(`⚠️ PDF validation warning: ${pdfResult.validation.reason}`);
      // Don't fail here - just log the warning and continue
    }

    // Get the cleaned text
    const resumeText = pdfResult.text;
    const validation = pdfResult.validation || { isValid: false, reason: 'No validation', wordCount: 0, commonWords: [] };
    
    console.log(`✅ PDF processed successfully!`);
    console.log(`📊 Stats: ${pdfResult.pages} pages, ${pdfResult.cleanedLength} characters`);
    
    // --- WORD COUNT DEFINITION ---
    // "wordCount" here means the total number of words successfully extracted from the uploaded resume PDF.
    // This is calculated after cleaning the text (removing extra whitespace, non-printable characters, etc.).
    // It is used to check if the resume is readable and valid for analysis.
    // If the word count is very low, it usually means the PDF is empty, image-only, or not a real resume.
    // This value is included in the validation object and is shown to the user for transparency.
    // -----------------------------
    console.log(`🔍 Words found: ${validation.wordCount} (words extracted from resume text)`);

    // Very basic final check (extremely lenient)
    if (resumeText.length < 30) {
      console.error('❌ Final text too short');
      return res.status(400).json({ 
        error: 'The text extracted from your PDF is too short. Please ensure your resume has some readable content.' 
      });
    }

    // Validate the text quality
    // Defensive: always check for validation object and wordCount
    if (validation && typeof validation.wordCount === 'number') {
      console.log(`✅ Text validation: ${validation.confidence || 0} confidence - ${validation.wordCount} words found`);
      if (validation.commonWords && validation.commonWords.length > 0) {
        console.log(`📋 Resume indicators found: ${validation.commonWords.join(', ')}`);
      }
    } else {
      console.warn('⚠️ Validation object missing or malformed');
    }console.log('🌐 Extracting job description from URL...');
    const jobDescription = await extractJobDescriptionFromURL(jobUrl);

    if (!jobDescription) {
      console.error('❌ Failed to extract job description');
      return res.status(500).json({ 
        error: 'Failed to fetch job description from the provided URL. Please check:\n' +
               '• The URL is accessible and public\n' +
               '• The website is not blocking automated requests\n' +
               '• The job posting still exists\n' +
               '• Try copying the job description manually if the issue persists'
      });
    }

    console.log(`✅ Job description extracted: ${jobDescription.length} characters`);

    // Validate job description content
    if (jobDescription.length < 100) {
      console.error('❌ Job description too short');
      return res.status(400).json({ 
        error: 'The job description appears to be too short or incomplete. Please verify the URL points to a complete job posting.'
      });
    }

    console.log('🤖 Generating AI analysis...');
    const aiResult = await generateAIResponse(resumeText, jobDescription);
    
    // Store the analysis data for potential editing
    const analysisId = Date.now().toString();
    req.session = req.session || {};
    req.session[analysisId] = {
      resumeText,
      jobDescription,
      originalResult: aiResult
    };

    // Format the AI result for match analysis in clean Markdown for frontend rendering
    if (aiResult && aiResult.matchAnalysis) {
      aiResult.matchAnalysisMarkdown = `### 1. MATCH SCORE: ${aiResult.matchAnalysis.score || 'N/A'}\n\n**Reasoning:**\n${aiResult.matchAnalysis.reasoning || 'No reasoning provided.'}\n\n### 2. STRENGTHS\n${(aiResult.matchAnalysis.strengths || []).map((s, i) => `- ${s}`).join('\\n') || 'None listed.'}\n\n### 3. WAYS TO IMPROVE\n${(aiResult.matchAnalysis.improvements || []).map((imp, i) => `${i+1}. ${imp}`).join('\\n') || 'None listed.'}`;
    }
    // Add analysis ID to response
    aiResult.analysisId = analysisId;
    
    console.log('✅ Analysis completed successfully');
    res.json(aiResult);

  } catch (error) {
    console.error('❌ AI analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Server error while analyzing your application: ' + error.message 
    });
  } finally {
    // Clean up uploaded file
    try {
      if (resumeFile && fs.existsSync(resumeFile.path)) {
        fs.unlinkSync(resumeFile.path);
        console.log('🧹 Cleaned up uploaded file');
      }
    } catch (cleanupError) {
      console.error('⚠️ Failed to cleanup file:', cleanupError.message);
    }
  }
});

// Test PDF upload endpoint for debugging
app.post('/test-pdf', upload.single('resume'), async (req, res) => {
  console.log('🧪 PDF test endpoint called');
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log('📁 File info:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });    const pdfResult = await processResumePDF(req.file.path);

    res.json({
      success: true,
      file: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      },
      extraction: {
        method: pdfResult.method,
        pages: pdfResult.pages,
        originalLength: pdfResult.originalLength,
        cleanedLength: pdfResult.cleanedLength,
        validation: pdfResult.validation,
        preview: pdfResult.text.substring(0, 500) + '...'
      }
    });

  } catch (error) {
    console.error('❌ PDF test failed:', error.message);
    res.status(500).json({ 
      error: error.message,
      file: req.file ? {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      } : null
    });
  } finally {
    // Clean up test file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Edit cover letter endpoint
app.post('/edit-cover-letter', async (req, res) => {
  console.log('✏️ Cover letter edit request received');
  
  const { analysisId, editedCoverLetter, instructions } = req.body;

  if (!analysisId || !editedCoverLetter) {
    return res.status(400).json({ 
      error: 'Analysis ID and edited cover letter content are required.' 
    });
  }

  try {
    // For now, just return the edited content
    // In a real implementation, you might want to validate or enhance the edited content
    const result = {
      success: true,
      editedCoverLetter,
      message: 'Cover letter updated successfully!'
    };

    console.log('✅ Cover letter edit completed');
    res.json(result);

  } catch (error) {
    console.error('❌ Cover letter edit failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to save cover letter edits: ' + error.message 
    });
  }
});

// Regenerate cover letter endpoint
app.post('/regenerate-cover-letter', async (req, res) => {
  console.log('🔄 Cover letter regeneration request received');
  
  const { analysisId, tone, length, focusAreas } = req.body;

  if (!analysisId) {
    return res.status(400).json({ 
      error: 'Analysis ID is required to regenerate cover letter.' 
    });
  }

  // Check if we have the original analysis data
  const analysisData = req.session[analysisId];
  if (!analysisData) {
    return res.status(404).json({ 
      error: 'Analysis data not found. Please run a new analysis.' 
    });
  }

  try {
    console.log('🤖 Regenerating cover letter with new parameters...');
    
    const newCoverLetter = await regenerateCoverLetter(
      analysisData.resumeText, 
      analysisData.jobDescription,
      { tone, length, focusAreas }
    );

    console.log('✅ Cover letter regeneration completed');
    res.json({
      success: true,
      newCoverLetter,
      message: 'Cover letter regenerated successfully!'
    });

  } catch (error) {
    console.error('❌ Cover letter regeneration failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to regenerate cover letter: ' + error.message 
    });
  }
});

// Get analysis data endpoint (for editing purposes)
app.get('/analysis/:analysisId', (req, res) => {
  const { analysisId } = req.params;
  
  const analysisData = req.session[analysisId];
  if (!analysisData) {
    return res.status(404).json({ 
      error: 'Analysis data not found.' 
    });
  }

  res.json({
    success: true,
    data: {
      hasData: true,
      timestamp: analysisId
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 JobPilot AI server running at http://localhost:${PORT}`);
});
