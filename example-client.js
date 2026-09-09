// Example client for using the GeiminiRevolver API
// This demonstrates how to use the OpenAI v1 compatible endpoint

const API_BASE_URL = 'http://localhost:3000';
const API_PASSWORD = 'change_this_secure_password'; // Change this to your configured password

async function chatCompletion(messages) {
  const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_PASSWORD}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gemini-flash-lite-latest',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Request failed');
  }

  return response.json();
}

async function listModels() {
  const response = await fetch(`${API_BASE_URL}/v1/models`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_PASSWORD}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Request failed');
  }

  return response.json();
}

async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

// Example usage
async function main() {
  try {
    console.log('Testing GeiminiRevolver API...\n');

    // Check health
    console.log('1. Health check:');
    const health = await getHealth();
    console.log(JSON.stringify(health, null, 2));
    console.log();

    // List models
    console.log('2. Available models:');
    const models = await listModels();
    console.log(JSON.stringify(models, null, 2));
    console.log();

    // Chat completion
    console.log('3. Chat completion:');
    const chatResponse = await chatCompletion([
      { role: 'user', content: 'What is 2+2? Answer with just the number.' }
    ]);
    console.log(JSON.stringify(chatResponse, null, 2));
    console.log();

    console.log('✓ All tests passed!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
main();
