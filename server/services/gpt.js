const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateAIResponse(resumeText, jobDescription) {
  const prompt = `
You are an AI assistant that helps evaluate resumes for job applications.

1. Based on the resume and job description below, rate the match out of 100.
2. Suggest 3 ways to improve the resume for this job.
3. Write a short, professional cover letter tailored to this job.

Resume:
${resumeText}

Job Description:
${jobDescription}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  return { ai_output: response.choices[0].message.content };
}

module.exports = { generateAIResponse };
