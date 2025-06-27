const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates an AI-powered analysis and cover letter for a given resume and job description.
 *
 * The AI is prompted to:
 *  - Rate the match between the resume and job requirements (MATCH SCORE)
 *  - List 2-3 key strengths (STRENGTHS)
 *  - Suggest 3-5 actionable improvements (WAYS TO IMPROVE)
 *  - Write a professional, personalized cover letter (COVER LETTER)
 *
 * @param {string} resumeText - The full text of the user's resume
 * @param {string} jobDescription - The full text of the job description
 * @returns {Promise<{ ai_output: string }>} - The AI's full response, including all sections
 */
async function generateAIResponse(resumeText, jobDescription) {
  const prompt = `
You are an AI assistant that helps evaluate resumes for job applications.

Please provide a comprehensive analysis with the following sections:

1. **MATCH SCORE**: Rate the match between resume and job requirements out of 100, with brief reasoning.

2. **STRENGTHS**: List 2-3 key strengths that align well with the job requirements.

3. **WAYS TO IMPROVE**: Provide 3-5 specific, actionable improvements to better match this job:
   - Add specific skills or technologies mentioned in the job posting
   - Include relevant keywords from the job description
   - Highlight specific experiences that match job requirements
   - Suggest certifications or qualifications to pursue
   - Recommend formatting or structural improvements

4. **COVER LETTER**: Write a professional, personalized cover letter (200-300 words) that:
   - Addresses the specific role and company
   - Highlights relevant experience and skills
   - Shows enthusiasm for the position
   - Includes a strong opening and closing

Resume:
${resumeText}

Job Description:
${jobDescription}

Please format your response clearly with section headers and use specific examples from both the resume and job description.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return { ai_output: response.choices[0].message.content };
}

/**
 * Regenerates a tailored cover letter using the AI, with options for tone, length, and focus areas.
 *
 * The AI is instructed to:
 *  - Use the specified tone (professional, formal, conversational, enthusiastic)
 *  - Write to the specified length (short, medium, long)
 *  - Focus on any user-specified areas (e.g., technical skills, leadership)
 *  - Address the specific role and company, highlight relevant experience, and include a strong opening/closing
 *
 * @param {string} resumeText - The full text of the user's resume
 * @param {string} jobDescription - The full text of the job description
 * @param {Object} options - Options for tone, length, and focus areas
 * @param {string} [options.tone] - The desired tone for the letter
 * @param {string} [options.length] - The desired length for the letter
 * @param {string[]} [options.focusAreas] - Specific areas to emphasize in the letter
 * @returns {Promise<string>} - The generated cover letter content only
 */
async function regenerateCoverLetter(resumeText, jobDescription, options = {}) {
  const { tone = 'professional', length = 'medium', focusAreas = [] } = options;
  
  let toneInstruction = '';
  switch (tone) {
    case 'formal':
      toneInstruction = 'Use a very formal, traditional business tone.';
      break;
    case 'conversational':
      toneInstruction = 'Use a friendly, conversational yet professional tone.';
      break;
    case 'enthusiastic':
      toneInstruction = 'Use an enthusiastic, energetic tone that shows excitement.';
      break;
    default:
      toneInstruction = 'Use a professional, polished tone.';
  }

  let lengthInstruction = '';
  switch (length) {
    case 'short':
      lengthInstruction = 'Keep it concise, around 150-200 words.';
      break;
    case 'long':
      lengthInstruction = 'Write a detailed cover letter, around 350-400 words.';
      break;
    default:
      lengthInstruction = 'Write a medium-length cover letter, around 250-300 words.';
  }

  let focusInstruction = '';
  if (focusAreas.length > 0) {
    focusInstruction = `Focus particularly on these areas: ${focusAreas.join(', ')}.`;
  }

  const prompt = `
Write a personalized cover letter based on the resume and job description provided.

Instructions:
- ${toneInstruction}
- ${lengthInstruction}
- ${focusInstruction}
- Address the specific role and company when possible
- Highlight the most relevant experience and skills
- Include a compelling opening and strong closing
- Make it unique and tailored to this specific opportunity

Resume:
${resumeText}

Job Description:
${jobDescription}

Please write only the cover letter content, without any additional commentary.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 1000,
  });

  return response.choices[0].message.content;
}

module.exports = { generateAIResponse, regenerateCoverLetter };
