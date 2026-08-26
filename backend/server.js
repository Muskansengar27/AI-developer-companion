const express = require('express');
const path = require('path');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

function sanitizeGeminiErrorMessage(error) {
  const message = typeof error?.message === 'string'
    ? error.message
    : 'Unknown Gemini API error';

  return message
    .replace(process.env.GEMINI_API_KEY || '', '[REDACTED]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[-_ ]?key|authorization|token|credential)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI Developer Companion backend is running',
  });
});

app.post('/api/analyze', async (req, res) => {
  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({
      error: 'Both code and language are required',
    });
  }

  if (!process.env.GEMINI_API_KEY || !gemini) {
    return res.status(503).json({
      error: 'Gemini API key is not configured',
    });
  }

  try {
    const result = await gemini.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Analyze the submitted code using the selected language as authoritative: ${language}. First check whether the code actually matches that language. If it does not, clearly identify a language mismatch in issues using the existing issue object structure, do not analyze the code as if it were written in ${language}, briefly explain in explanation what language it appears to use and why it does not match ${language}, make improvements focus on converting or correcting it to ${language}, use testCases only for a short recommendation to correct the mismatch first, and have documentation describe the mismatch rather than pretend the code is valid ${language} code. For matching code, identify only real, evidence-based syntax errors, logical issues, runtime risks, and code-quality issues; do not invent problems. If matching code has no meaningful issues, return an empty issues array. Make improvements relevant to the actual submitted code, generate test cases for its behavior and edge cases, and write documentation that accurately describes what the submitted code does. Return ONLY valid JSON with exactly these five fields: explanation, issues, improvements, testCases, documentation. The explanation, improvements, testCases, and documentation fields must be strings. The issues field must be an array. Each issue in the array must contain exactly these four string fields: type, location, description, suggestion. Do not include Markdown fences or any additional fields.

Code:
${code}`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const analysis = JSON.parse(result.text);
    const textFields = ['explanation', 'improvements', 'testCases', 'documentation'];
    const issueFields = ['type', 'location', 'description', 'suggestion'];

    const validIssues = Array.isArray(analysis.issues)
      && analysis.issues.every((issue) => (
        issue
        && typeof issue === 'object'
        && Object.keys(issue).length === issueFields.length
        && issueFields.every((field) => typeof issue[field] === 'string')
      ));

    if (!textFields.every((field) => typeof analysis[field] === 'string') || !validIssues) {
      throw new Error('Gemini returned an invalid analysis shape');
    }

    res.json({
      explanation: analysis.explanation,
      issues: analysis.issues,
      improvements: analysis.improvements,
      testCases: analysis.testCases,
      documentation: analysis.documentation,
    });
  } catch (error) {
    console.error('Gemini analysis request failed', {
      status: error?.status ?? error?.response?.status ?? 'unknown',
      name: error?.name || 'Error',
      message: sanitizeGeminiErrorMessage(error),
    });

    res.status(502).json({
      error: 'Unable to analyze code with Gemini',
    });
  }
});

app.get('/api/ai-test', async (req, res) => {
  if (!process.env.GEMINI_API_KEY || !gemini) {
    return res.status(503).json({
      error: 'Gemini API key is not configured',
    });
  }

  try {
    const result = await gemini.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: 'Reply with exactly: Gemini connection successful.',
    });

    res.json({ response: result.text });
  } catch (error) {
    console.error('Gemini API request failed', {
      status: error?.status ?? error?.response?.status ?? 'unknown',
      name: error?.name || 'Error',
      message: sanitizeGeminiErrorMessage(error),
    });

    res.status(502).json({
      error: 'Gemini API request failed',
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});