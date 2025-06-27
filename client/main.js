// main.js for JobPilot AI
// All frontend JavaScript from index.html moved here for maintainability
//
// This file handles all client-side logic for file upload, job URL validation, analysis submission,
// result display, cover letter extraction, and user interactions.

let currentStep = 1;
let analysisInterval;
let currentResults = null;

// Progress Step Management
function updateStep(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active', 'completed'));
  for (let i = 1; i <= step; i++) {
    if (i < step) {
      document.querySelector(`[data-step="${i}"]`).classList.add('completed');
    } else {
      document.querySelector(`[data-step="${i}"]`).classList.add('active');
    }
  }
  currentStep = step;
}

// File Upload Handling
const fileInput = document.getElementById('resume');
const fileUploadOverlay = document.getElementById('fileUploadOverlay');
const fileInfo = document.getElementById('fileInfo');

fileInput.addEventListener('change', handleFileSelect);
fileUploadOverlay.addEventListener('click', () => fileInput.click());
fileUploadOverlay.addEventListener('dragover', handleDragOver);
fileUploadOverlay.addEventListener('drop', handleDrop);

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    displayFileInfo(file);
    updateStep(2);
    showToast('File uploaded successfully!', 'success');
  }
}

function handleDragOver(e) {
  e.preventDefault();
  fileUploadOverlay.classList.add('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  fileUploadOverlay.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    fileInput.files = e.dataTransfer.files;
    displayFileInfo(file);
    updateStep(2);
    showToast('File uploaded successfully!', 'success');
  } else {
    showToast('Please upload a PDF file', 'error');
  }
}

function displayFileInfo(file) {
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  fileInfo.classList.remove('d-none');
  fileUploadOverlay.style.display = 'none';
  // Test the PDF file for validity
  testPDFFile(file);
}

async function testPDFFile(file) {
  try {
    const formData = new FormData();
    formData.append('resume', file);
    
    const response = await fetch('http://localhost:3000/test-pdf', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ PDF test successful:', result);
      
      // Add success indicator
      const fileInfo = document.getElementById('fileInfo');
      const existingAlert = fileInfo.querySelector('.alert');
      if (existingAlert) {
        existingAlert.innerHTML = `
          <i class="fas fa-check-circle me-2"></i>
          <span id="fileName">${file.name}</span>
          <span class="badge bg-success ms-2" id="fileSize">${formatFileSize(file.size)}</span>
          <div class="mt-2">
            <small class="text-success">
              <i class="fas fa-info-circle me-1"></i>
              PDF validated: ${result.extraction.pages} pages, ${result.extraction.cleanedLength} characters extracted
            </small>
          </div>
        `;
      }
      
    } else {
      console.error('❌ PDF test failed:', result.error);
      showPDFError(result.error);
    }
    
  } catch (error) {
    console.error('❌ PDF test error:', error);
    showPDFError('Unable to validate PDF file. The file may still work for analysis.');
  }
}

function showPDFError(errorMessage) {
  const fileInfo = document.getElementById('fileInfo');
  const existingAlert = fileInfo.querySelector('.alert');
  if (existingAlert) {
    existingAlert.className = 'alert alert-warning';
    existingAlert.innerHTML = `
      <i class="fas fa-exclamation-triangle me-2"></i>
      <span id="fileName">${fileInput.files[0].name}</span>
      <span class="badge bg-warning text-dark ms-2" id="fileSize">${formatFileSize(fileInput.files[0].size)}</span>
      <div class="mt-2">
        <small class="text-warning">
          <i class="fas fa-exclamation-triangle me-1"></i>
          PDF Warning: ${errorMessage}
        </small>
      </div>
      <div class="mt-2">
        <button class="btn btn-sm btn-outline-warning" onclick="showPDFHelp()">
          <i class="fas fa-question-circle me-1"></i>Need Help?
        </button>
      </div>
    `;
  }
}

function showPDFHelp() {
  const helpHTML = `
    <div class="modal fade" id="pdfHelpModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-info text-white">
            <h5 class="modal-title">
              <i class="fas fa-question-circle me-2"></i>PDF Upload Help
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <h6><i class="fas fa-file-pdf me-2 text-danger"></i>PDF Requirements:</h6>
            <ul class="mb-3">
              <li>File must contain selectable text (not scanned images)</li>
              <li>Maximum file size: 10MB</li>
              <li>Text should be readable when you can select it in a PDF viewer</li>
            </ul>
            
            <h6><i class="fas fa-tools me-2 text-warning"></i>If you're having issues:</h6>
            <ul class="mb-3">
              <li><strong>Export as PDF</strong> instead of "Print to PDF"</li>
              <li>Use <strong>Save as PDF</strong> from Word/Google Docs</li>
              <li>Ensure text is selectable in your PDF viewer</li>
              <li>Avoid scanned or image-based PDFs</li>
            </ul>
            
            <h6><i class="fas fa-lightbulb me-2 text-success"></i>Recommendations:</h6>
            <ul class="mb-0">
              <li>Create your resume in Word/Google Docs</li>
              <li>Use standard fonts (Arial, Times New Roman, Calibri)</li>
              <li>Save directly as PDF (not print to PDF)</li>
              <li>Test by trying to select text in the PDF</li>
            </ul>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
              <i class="fas fa-check me-1"></i>Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('pdfHelpModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Add modal to DOM
  document.body.insertAdjacentHTML('beforeend', helpHTML);
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('pdfHelpModal'));
  modal.show();
}

function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// URL Validation
document.getElementById('validateUrl').addEventListener('click', validateJobUrl);
document.getElementById('jobUrl').addEventListener('input', function() {
  if (this.value.trim()) {
    updateStep(3);
  }
});

async function validateJobUrl() {
  const url = document.getElementById('jobUrl').value;
  const validation = document.getElementById('urlValidation');
  
  if (!url) {
    validation.innerHTML = '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle me-2"></i>Please enter a URL</div>';
    validation.classList.remove('d-none');
    return;
  }

  try {
    new URL(url);
    validation.innerHTML = '<div class="alert alert-success"><i class="fas fa-check-circle me-2"></i>URL format is valid</div>';
    validation.classList.remove('d-none');
    showToast('URL validated successfully!', 'success');
  } catch {
    validation.innerHTML = '<div class="alert alert-danger"><i class="fas fa-times-circle me-2"></i>Invalid URL format</div>';
    validation.classList.remove('d-none');
    showToast('Invalid URL format', 'error');
  }
}

// Form Submission
document.getElementById('jobForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  
  const formData = new FormData(this);
  const analyzeBtn = document.getElementById('analyzeBtn');
  const btnText = analyzeBtn.querySelector('.btn-text');
  const btnSpinner = document.getElementById('btnSpinner');
  
  // Update UI for loading state
  updateStep(3);
  analyzeBtn.disabled = true;
  btnText.textContent = 'Analyzing...';
  btnSpinner.classList.remove('d-none');
  
  document.getElementById('result-container').classList.remove('d-none');
  document.getElementById('loadingSection').classList.remove('d-none');
  document.getElementById('resultsContent').classList.add('d-none');
  
  updateStatus('Analyzing', 'warning');
  startProgressAnimation();

  try {
    const res = await fetch('http://localhost:3000/analyze', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    currentResults = data;
    displayResults(data.ai_output || data.result);
    
    // Store analysis ID for editing purposes
    if (data.analysisId) {
      currentResults.analysisId = data.analysisId;
    }
    
    updateStep(4);
    updateStatus('Complete', 'success');
    showToast('Analysis completed successfully!', 'success');
    
  } catch (error) {
    console.error('Error:', error);
    showToast('Analysis failed: ' + error.message, 'error');
    updateStatus('Error', 'danger');
  } finally {
    // Reset button
    analyzeBtn.disabled = false;
    btnText.textContent = 'Start Analysis';
    btnSpinner.classList.add('d-none');
    stopProgressAnimation();
  }
});

function startProgressAnimation() {
  const progressBar = document.getElementById('analysisProgress');
  let progress = 0;
  
  analysisInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 90) progress = 90;
    progressBar.style.width = progress + '%';
  }, 500);
}

function stopProgressAnimation() {
  if (analysisInterval) {
    clearInterval(analysisInterval);
    document.getElementById('analysisProgress').style.width = '100%';
  }
}

function displayResults(result) {
  // Show results section, hide loading
  document.getElementById('loadingSection').classList.add('d-none');
  document.getElementById('resultsContent').classList.remove('d-none');

  const matchDiv = document.getElementById('match');
  const coverDiv = document.getElementById('coverLetter');

  // Render match analysis (Markdown or fallback)
  if (currentResults && currentResults.matchAnalysisMarkdown) {
    matchDiv.innerHTML = marked.parse(currentResults.matchAnalysisMarkdown);
  } else {
    // Fallback: extract match content (before "cover letter")
    const coverIndex = result.toLowerCase().indexOf("cover letter");
    let matchContent = '';
    if (coverIndex !== -1) {
      matchContent = result.slice(0, coverIndex).trim();
    } else {
      matchContent = result;
    }
    matchDiv.innerHTML = formatMatchContent(matchContent);
  }

  // --- COVER LETTER EXTRACTION ---
  // Extract cover letter content robustly, only once
  let coverContent = '';
  if (currentResults && currentResults.coverLetter) {
    coverContent = currentResults.coverLetter;
  } else {
    // Fallback: extract from result string if possible
    const coverIndex = result.toLowerCase().indexOf("cover letter");
    if (coverIndex !== -1) {
      coverContent = result.slice(coverIndex).replace(/cover letter[:\s]*/i, '').trim();
    } else {
      coverContent = '';
    }
  }
  // Only display the cover letter section if content is found
  coverDiv.innerHTML = formatCoverLetter(coverContent);

  // Extract and display match score (if present)
  let matchContentForScore = result;
  if (currentResults && currentResults.matchAnalysisMarkdown) {
    matchContentForScore = currentResults.matchAnalysisMarkdown;
  }
  // Try to match "85%" or "MATCH SCORE: 55/100"
  let score = null;
  let percentMatch = matchContentForScore.match(/(\d+)%/);
  if (percentMatch) {
    score = parseInt(percentMatch[1]);
  } else {
    // Fix: use single backslashes and correct regex for 'MATCH SCORE: 55/100'
    let fractionMatch = matchContentForScore.match(/match score\D*(\d{1,3})\s*\/\s*(\d{2,3})/i);
    if (fractionMatch) {
      let value = parseInt(fractionMatch[1]);
      let total = parseInt(fractionMatch[2]);
      if (total && total > 0) {
        score = Math.round((value / total) * 100);
      }
    }
  }
  if (score !== null) {
    updateMatchScore(score);
    setScoreCircleVisible(true);
  } else {
    updateMatchScore(null);
    setScoreCircleVisible(false);
  }

  // Generate key insights and improvements
  generateKeyInsights(matchContentForScore);
  generateImprovements(matchContentForScore);
}

// Update the match score display in the circle
function updateMatchScore(score) {
  const scoreValue = document.getElementById('scoreValue');
  const circle = document.getElementById('matchScoreCircle');
  if (score !== null && !isNaN(score)) {
    scoreValue.textContent = score + '%';
    // Remove previous score classes
    circle.classList.remove('high-score', 'medium-score', 'low-score');
    // Update circle color based on score
    if (score >= 80) {
      circle.classList.add('high-score');
    } else if (score >= 60) {
      circle.classList.add('medium-score');
    } else {
      circle.classList.add('low-score');
    }
  } else {
    scoreValue.textContent = 'N/A';
    circle.classList.remove('high-score', 'medium-score', 'low-score');
  }
}

// Show or hide the score circle and label
function setScoreCircleVisible(visible) {
  const circle = document.getElementById('matchScoreCircle');
  const scoreValue = document.getElementById('scoreValue');
  const scoreLabel = document.querySelector('.match-score-label'); // Add this class to your label in HTML
  if (visible) {
    circle.style.display = '';
    scoreValue.style.display = '';
    if (scoreLabel) scoreLabel.style.display = '';
  } else {
    // Optionally hide the circle and label if no score
    // Or just show N/A (handled above)
    // Uncomment below to hide:
    // circle.style.display = 'none';
    // scoreValue.style.display = 'none';
    // if (scoreLabel) scoreLabel.style.display = 'none';
  }
}

/**
 * Formats the match analysis content for display in the UI.
 * Cleans up markdown, removes unwanted artifacts, and applies custom HTML formatting for sections and lists.
 * - Removes markdown headers, horizontal rules, bold markers, and template artifacts
 * - Converts bullet points to HTML lists
 * - Wraps improvement and strength sections in styled divs
 * - Hides 'Match Score' and 'Score' lines (score is shown in the circle only)
 * - Highlights percentages and quoted keywords
 *
 * @param {string} content - Raw match analysis content (from AI or fallback)
 * @returns {string} - HTML-formatted string for display
 */
function formatMatchContent(content) {
  // Enhanced formatting for match content with structured improvements
  let formatted = content;

  // Remove all Markdown horizontal rules (---) and headers (###, ##, #) anywhere in the text
  formatted = formatted.replace(/-{3,}/g, ''); // Remove any sequence of 3 or more dashes
  formatted = formatted.replace(/#+\s*/g, ''); // Remove all Markdown headers

  // Remove any leftover 'improvement-list">' from the output
  formatted = formatted.replace(/improvement-list">/g, '');

  // Remove all occurrences of '**' (bold markers)
  formatted = formatted.replace(/\*\*/g, '');

  // Format bullet points as HTML list items
  formatted = formatted.replace(/^\s*[-*]\s+/gm, '<li>');
  formatted = formatted.replace(/\n(?=<li>)/g, '</li>\n');

  // Wrap lists in ul tags if any list items are present
  if (formatted.includes('<li>')) {
    formatted = formatted.replace(/(<li>.*?)(?=\n(?![<li>])|$)/gs, '<ul class="improvement-list">$1</li></ul>');
  }

  // Format sections with headers (except Match Score/Score, which we want to hide)
  formatted = formatted.replace(/^(Ways to improve|Improvements?|Suggestions?|Recommendations?):/gmi, 
    '<div class="improvement-section"><h6 class="improvement-header"><i class="fas fa-lightbulb text-warning me-2"></i>$1:</h6>');

  formatted = formatted.replace(/^(Strengths?|Strong points?):/gmi, 
    '<div class="strength-section"><h6 class="strength-header"><i class="fas fa-check-circle text-success me-2"></i>$1:</h6>');

  // Remove 'Match Score:' or 'Score:' lines entirely from the output
  formatted = formatted.replace(/^(Match Score|Score):.*$/gmi, '');

  // Format percentages and scores as badges
  formatted = formatted.replace(/(\d+)%/g, '<span class="badge bg-primary">$1%</span>');

  // Highlight keywords in quotes
  formatted = formatted.replace(/"([^"]+)"/g, '<span class="keyword-highlight">"$1"</span>');

  // Close sections if any are open
  if (formatted.includes('<div class="improvement-section">') || 
      formatted.includes('<div class="strength-section">') || 
      formatted.includes('<div class="score-section">')) {
    formatted = formatted.replace(/(<div class="[^"]*-section">.*?)(?=<div class="[^"]*-section">|$)/gs, '$1</div>');
  }

  // Convert line breaks to <br> for HTML display
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

// Format the cover letter for display (formatting only, no extraction)
function formatCoverLetter(content) {
  if (!content) return '';
  // Remove all occurrences of '**' (bold markers)
  let formatted = content.replace(/\*\*/g, '');
  // Only format: convert line breaks
  return formatted.replace(/\n/g, '<br>');
}

function generateKeyInsights(matchContent) {
  const insights = document.getElementById('keyInsights');
  
  // Try to extract actual insights from the content
  const extractedInsights = [];
  
  // Look for common improvement patterns
  const improvementPatterns = [
    /add\s+([^.]+)/gi,
    /include\s+([^.]+)/gi,
    /mention\s+([^.]+)/gi,
    /highlight\s+([^.]+)/gi,
    /emphasize\s+([^.]+)/gi,
    /strengthen\s+([^.]+)/gi
  ];
  
  improvementPatterns.forEach(pattern => {
    const matches = matchContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (match.length > 10 && match.length < 100) {
          extractedInsights.push(match.charAt(0).toUpperCase() + match.slice(1));
        }
      });
    }
  });
  
  // If we found insights, use them, otherwise use defaults
  const finalInsights = extractedInsights.length > 0 ? 
    extractedInsights.slice(0, 4) : [
      'Skills alignment with job requirements',
      'Experience relevance to the role',
      'Areas for improvement identified',
      'Keyword optimization suggestions'
    ];
  
  insights.innerHTML = finalInsights.map(insight => `<li>${insight}</li>`).join('');
}

function generateImprovements(matchContent) {
  // Extract specific improvements and display them in a structured format
  const improvementsSection = document.createElement('div');
  improvementsSection.className = 'improvements-breakdown mt-3';
  improvementsSection.id = 'improvementsBreakdown';
  
  // Parse different types of improvements
  const improvements = parseImprovements(matchContent);
  
  if (improvements.length > 0) {
    let improvementsHTML = `
      <div class="card border-warning mt-3">
        <div class="card-header bg-warning bg-opacity-10">
          <h6 class="mb-0"><i class="fas fa-tools me-2"></i>Actionable Improvements</h6>
        </div>
        <div class="card-body">
          <div class="improvement-items">
    `;
    
    improvements.forEach((improvement, index) => {
      const priorityClass = getPriorityClass(improvement.text);
      const icon = getPriorityIcon(improvement.type);
      
      improvementsHTML += `
        <div class="improvement-item mb-2" data-priority="${improvement.priority}">
          <div class="d-flex align-items-start">
            <span class="badge bg-${getPriorityColor(improvement.priority)} text-white me-2">
              <i class="${icon} me-1"></i>${index + 1}
            </span>
            <div class="improvement-content">
              <div class="improvement-text">${improvement.text}</div>
              ${improvement.category ? `<small class="text-muted mt-1 d-block">
                <i class="fas fa-tag me-1"></i>${improvement.category}
              </small>` : ''}
            </div>
          </div>
        </div>
      `;
    });
    
    improvementsHTML += `
          </div>
          <div class="mt-3 text-center">
            <small class="text-muted">
              <i class="fas fa-info-circle me-1"></i>
              Click "View Details" to see specific recommendations for your resume
            </small>
          </div>
        </div>
      </div>
    `;
    
    // Add to the match details collapse section
    const matchDetails = document.getElementById('matchDetails');
    if (matchDetails && !document.getElementById('improvementsBreakdown')) {
      matchDetails.innerHTML += improvementsHTML;
    }
  }
}

function parseImprovements(content) {
  const improvements = [];
  const sentences = content.split(/[.!?]+/);
  
  // Keywords that indicate different types of improvements
  const improvementCategories = {
    skills: ['skill', 'technical', 'programming', 'software', 'technology'],
    experience: ['experience', 'project', 'work', 'role', 'position'],
    keywords: ['keyword', 'term', 'phrase', 'mention', 'include'],
    education: ['education', 'degree', 'certification', 'course', 'training'],
    format: ['format', 'structure', 'layout', 'organize', 'section']
  };
  
  const actionWords = [
    'add', 'include', 'mention', 'highlight', 'emphasize', 'strengthen',
    'improve', 'enhance', 'consider', 'suggest', 'recommend', 'focus'
  ];
  
  sentences.forEach(sentence => {
    const lowerSentence = sentence.toLowerCase().trim();
    
    // Check if sentence contains improvement language
    if (actionWords.some(word => lowerSentence.includes(word)) && 
        lowerSentence.length > 20 && lowerSentence.length < 200) {
      
      const improvement = {
        text: sentence.trim(),
        priority: 'medium',
        category: null,
        type: 'general'
      };
      
      // Categorize the improvement
      for (const [category, keywords] of Object.entries(improvementCategories)) {
        if (keywords.some(keyword => lowerSentence.includes(keyword))) {
          improvement.category = category.charAt(0).toUpperCase() + category.slice(1);
          improvement.type = category;
          break;
        }
      }
      
      // Determine priority based on keywords
      if (lowerSentence.includes('important') || lowerSentence.includes('critical') || 
          lowerSentence.includes('essential') || lowerSentence.includes('must')) {
        improvement.priority = 'high';
      } else if (lowerSentence.includes('consider') || lowerSentence.includes('might') || 
                lowerSentence.includes('could')) {
        improvement.priority = 'low';
      }
      
      improvements.push(improvement);
    }
  });
  
  // Sort by priority (high, medium, low)
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  improvements.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  
  return improvements.slice(0, 5); // Limit to top 5 improvements
}

function getPriorityClass(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('important') || lowerText.includes('critical')) return 'high';
  if (lowerText.includes('consider') || lowerText.includes('might')) return 'low';
  return 'medium';
}

function getPriorityIcon(type) {
  const icons = {
    skills: 'fas fa-code',
    experience: 'fas fa-briefcase',
    keywords: 'fas fa-key',
    education: 'fas fa-graduation-cap',
    format: 'fas fa-align-left',
    general: 'fas fa-lightbulb'
  };
  return icons[type] || icons.general;
}

function getPriorityColor(priority) {
  const colors = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
  };
  return colors[priority] || 'secondary';
}

// Utility Functions
function updateStatus(text, type) {
  const statusIndicator = document.getElementById('status-indicator');
  const iconClass = type === 'success' ? 'text-success' : 
                   type === 'warning' ? 'text-warning' : 
                   type === 'danger' ? 'text-danger' : 'text-success';
  
  statusIndicator.innerHTML = `<i class="fas fa-circle ${iconClass} me-1"></i>${text}`;
}

function showToast(message, type) {
  const toastId = type === 'success' ? 'successToast' : 'errorToast';
  const toast = document.getElementById(toastId);
  const toastBody = toast.querySelector('.toast-body');
  
  toastBody.textContent = message;
  new bootstrap.Toast(toast).show();
}

function toggleDetails(elementId) {
  const element = document.getElementById(elementId);
  new bootstrap.Collapse(element).toggle();
}
// Download and Export Functions
function downloadWord() {
  const coverText = document.getElementById('coverLetter').textContent;
  const blob = new Blob([coverText], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Cover_Letter.doc';
  link.click();
  showToast('Cover letter downloaded!', 'success');
}

function downloadPDF() {
  showToast('PDF download feature coming soon!', 'success');
}

function copyToClipboard() {
  const coverText = document.getElementById('coverLetter').textContent;
  navigator.clipboard.writeText(coverText).then(() => {
    showToast('Cover letter copied to clipboard!', 'success');
  });
}

function editCoverLetter() {
  const coverLetterDiv = document.getElementById('coverLetter');
  const currentText = coverLetterDiv.innerHTML.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '');
  
  // Create modal for editing
  const modalHTML = `
    <div class="modal fade" id="editCoverLetterModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">
              <i class="fas fa-edit me-2"></i>Edit Cover Letter
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="coverLetterEditor" class="form-label fw-bold">Cover Letter Content:</label>
              <textarea class="form-control" id="coverLetterEditor" rows="15" 
                        placeholder="Edit your cover letter here...">${currentText}</textarea>
              <div class="form-text">
                <i class="fas fa-info-circle me-1"></i>
                Make your changes above. The letter will be automatically formatted.
              </div>
            </div>
            <div class="d-flex justify-content-between align-items-center">
              <div class="text-muted">
                <small>
                  <i class="fas fa-chart-bar me-1"></i>
                  Characters: <span id="charCount">0</span> | 
                  Words: <span id="wordCount">0</span>
                </small>
              </div>
              <div>
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="resetCoverLetter()">
                  <i class="fas fa-undo me-1"></i>Reset
                </button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              <i class="fas fa-times me-1"></i>Cancel
            </button>
            <button type="button" class="btn btn-success" onclick="saveCoverLetterEdits()">
              <i class="fas fa-save me-1"></i>Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('editCoverLetterModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Add modal to DOM
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Initialize modal
  const modal = new bootstrap.Modal(document.getElementById('editCoverLetterModal'));
  modal.show();
  
  // Add character/word count functionality
  const editor = document.getElementById('coverLetterEditor');
  const charCount = document.getElementById('charCount');
  const wordCount = document.getElementById('wordCount');
  
  function updateCounts() {
    const text = editor.value;
    charCount.textContent = text.length;
    wordCount.textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
  }
  
  editor.addEventListener('input', updateCounts);
  updateCounts(); // Initial count
}

function resetCoverLetter() {
  const editor = document.getElementById('coverLetterEditor');
  const coverLetterDiv = document.getElementById('coverLetter');
  const originalText = coverLetterDiv.innerHTML.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '');
  editor.value = originalText;
  
  // Update counts
  const event = new Event('input');
  editor.dispatchEvent(event);
}

async function saveCoverLetterEdits() {
  const editor = document.getElementById('coverLetterEditor');
  const editedText = editor.value.trim();
  
  if (!editedText) {
    showToast('Cover letter cannot be empty!', 'error');
    return;
  }
  
  if (!currentResults || !currentResults.analysisId) {
    showToast('Analysis data not found. Please run a new analysis.', 'error');
    return;
  }
  
  try {
    const saveBtn = document.querySelector('#editCoverLetterModal .btn-success');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saving...';
    saveBtn.disabled = true;
    
    const response = await fetch('http://localhost:3000/edit-cover-letter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysisId: currentResults.analysisId,
        editedCoverLetter: editedText
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update the cover letter display
      const coverLetterDiv = document.getElementById('coverLetter');
      coverLetterDiv.innerHTML = formatCoverLetter(editedText);
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('editCoverLetterModal'));
      modal.hide();
      
      showToast('Cover letter updated successfully!', 'success');
    } else {
      throw new Error(result.error || 'Failed to save edits');
    }
    
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save changes: ' + error.message, 'error');
  } finally {
    const saveBtn = document.querySelector('#editCoverLetterModal .btn-success');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Changes';
      saveBtn.disabled = false;
    }
  }
}

async function regenerateCoverLetter() {
  if (!currentResults || !currentResults.analysisId) {
    showToast('Analysis data not found. Please run a new analysis.', 'error');
    return;
  }
  
  // Create regeneration options modal
  const modalHTML = `
    <div class="modal fade" id="regenerateModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-info text-white">
            <h5 class="modal-title">
              <i class="fas fa-sync me-2"></i>Regenerate Cover Letter
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="toneSelect" class="form-label fw-bold">Tone:</label>
              <select class="form-select" id="toneSelect">
                <option value="professional">Professional</option>
                <option value="formal">Formal</option>
                <option value="conversational">Conversational</option>
                <option value="enthusiastic">Enthusiastic</option>
              </select>
            </div>
            <div class="mb-3">
              <label for="lengthSelect" class="form-label fw-bold">Length:</label>
              <select class="form-select" id="lengthSelect">
                <option value="short">Short (150-200 words)</option>
                <option value="medium" selected>Medium (250-300 words)</option>
                <option value="long">Long (350-400 words)</option>
              </select>
            </div>
            <div class="mb-3">
              <label for="focusAreas" class="form-label fw-bold">Focus Areas (optional):</label>
              <input type="text" class="form-control" id="focusAreas" 
                     placeholder="e.g., technical skills, leadership experience, project management">
              <div class="form-text">Separate multiple areas with commas</div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-info" onclick="executeRegeneration()">
              <i class="fas fa-magic me-1"></i>Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('regenerateModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Add modal to DOM
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('regenerateModal'));
  modal.show();
}

async function executeRegeneration() {
  const tone = document.getElementById('toneSelect').value;
  const length = document.getElementById('lengthSelect').value;
  const focusAreasText = document.getElementById('focusAreas').value;
  const focusAreas = focusAreasText ? focusAreasText.split(',').map(area => area.trim()) : [];
  
  try {
    const regenBtn = document.querySelector('#regenerateModal .btn-info');
    const originalText = regenBtn.innerHTML;
    regenBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Regenerating...';
    regenBtn.disabled = true;
    
    const response = await fetch('http://localhost:3000/regenerate-cover-letter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysisId: currentResults.analysisId,
        tone,
        length,
        focusAreas
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update the cover letter display
      const coverLetterDiv = document.getElementById('coverLetter');
      coverLetterDiv.innerHTML = formatCoverLetter(result.newCoverLetter);
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('regenerateModal'));
      modal.hide();
      
      showToast('Cover letter regenerated successfully!', 'success');
    } else {
      throw new Error(result.error || 'Failed to regenerate cover letter');
    }
    
  } catch (error) {
    console.error('Regeneration error:', error);
    showToast('Failed to regenerate cover letter: ' + error.message, 'error');
  } finally {
    const regenBtn = document.querySelector('#regenerateModal .btn-info');
    if (regenBtn) {
      regenBtn.innerHTML = '<i class="fas fa-magic me-1"></i>Regenerate';
      regenBtn.disabled = false;
    }
  }
}

function resetForm() {
  document.getElementById('jobForm').reset();
  document.getElementById('result-container').classList.add('d-none');
  document.getElementById('fileInfo').classList.add('d-none');
  document.getElementById('fileUploadOverlay').style.display = 'block';
  document.getElementById('urlValidation').classList.add('d-none');
  updateStep(1);
  updateStatus('Ready', 'success');
}

function shareResults() {
  if (navigator.share) {
    navigator.share({
      title: 'JobPilot AI Analysis Results',
      text: 'Check out my job application analysis results!',
      url: window.location.href
    });
  } else {
    showToast('Sharing feature not supported on this browser', 'error');
  }
}
