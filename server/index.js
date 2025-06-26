const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cheerio = require('cheerio');
const { generateAIResponse } = require('./services/gpt');

dotenv.config();
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

const upload = multer({ dest: 'public/uploads/' });

// Scrape job description from a public job posting URL
async function extractJobDescriptionFromURL(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const text = $('body').text();
    return text.replace(/\s+/g, ' ').trim().slice(0, 4000);
  } catch (err) {
    console.error('Failed to extract job description:', err.message);
    return null;
  }
}

app.post('/analyze', upload.single('resume'), async (req, res) => {
  const jobUrl = req.body.jobUrl;
  const resumeFile = req.file;

  if (!resumeFile || !jobUrl) {
    return res.status(400).json({ error: 'Missing resume or job link.' });
  }

  try {
    const pdfBuffer = fs.readFileSync(resumeFile.path);
    const resumeText = await pdfParse(pdfBuffer).then(data => data.text);
    const jobDescription = await extractJobDescriptionFromURL(jobUrl);

    if (!jobDescription) {
      return res.status(500).json({ error: 'Failed to fetch job description from link.' });
    }

    const aiResult = await generateAIResponse(resumeText, jobDescription);
    res.json(aiResult);
  } catch (error) {
    console.error('AI analysis failed:', error.message);
    res.status(500).json({ error: 'Server error while analyzing job link and resume.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 JobPilot AI server running at http://localhost:${PORT}`);
});
