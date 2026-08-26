const analyzeButton = document.getElementById('analyze-button');
const codeInput = document.getElementById('code-input');
const languageInput = document.getElementById('language');
const temporaryMessage = document.getElementById('temporary-message');
const statusIndicator = document.querySelector('.status-dot');
const resultCards = document.querySelectorAll('.result-card');

const resultFields = ['explanation', 'issues', 'improvements', 'testCases', 'documentation'];

const displayIssues = (issues, resultText) => {
  resultText.textContent = '';

  if (!issues.length) {
    resultText.textContent = 'No issues found.';
    return;
  }

  issues.forEach((issue, index) => {
    const issueLines = [
      `Issue ${index + 1}`,
      `Type: ${issue.type}`,
      `Location: ${issue.location}`,
      `Description: ${issue.description}`,
      `Suggested fix: ${issue.suggestion}`,
    ];

    issueLines.forEach((line) => {
      const lineElement = document.createElement('span');
      lineElement.textContent = line;
      resultText.append(lineElement, document.createElement('br'));
    });

    if (index < issues.length - 1) {
      resultText.append(document.createElement('br'));
    }
  });
};

const displayResults = (results) => {
  resultCards.forEach((card, index) => {
    const resultText = card.querySelector('p');

    if (resultFields[index] === 'issues') {
      displayIssues(results.issues, resultText);
      return;
    }

    resultText.textContent = results[resultFields[index]];
  });
};

analyzeButton.addEventListener('click', async () => {
  const code = codeInput.value.trim();
  const language = languageInput.value;

  if (!code) {
    temporaryMessage.textContent = 'Please enter some code before analyzing.';
    return;
  }

  resultCards.forEach((card) => {
    card.querySelector('p').textContent = '';
  });

  analyzeButton.disabled = true;
  analyzeButton.textContent = 'Analyzing...';
  temporaryMessage.textContent = 'Analyzing your code...';

  try {
    const apiBaseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : '';

    const response = await fetch(`${apiBaseUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, language }),
    });

    const responseText = await response.text();
    let result = {};

    if (responseText.trim()) {
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`The server returned an invalid response (${response.status}).`);
      }
    }

    if (!response.ok) {
      throw new Error(result.error || 'Unable to analyze the code.');
    }

    displayResults(result);
    statusIndicator.textContent = 'Analysis complete';
    temporaryMessage.textContent = 'Analysis complete.';
  } catch (error) {
    statusIndicator.textContent = 'Analysis failed';
    temporaryMessage.textContent = error.message || 'Something went wrong while analyzing the code.';
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.innerHTML = 'Analyze Code <span aria-hidden="true">&#8594;</span>';
  }
});