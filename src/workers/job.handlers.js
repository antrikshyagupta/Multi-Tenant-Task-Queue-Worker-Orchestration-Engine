// Simulate real async work with a helper delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const handlers = {
  GENERATE_REPORT: async (payload) => {
    console.log(`[Handler] Generating ${payload.reportType} report for ${payload.month}...`);
    await sleep(2000); // Simulate 2 seconds of report generation work
    return {
      reportUrl: `https://storage.example.com/reports/${payload.month}-${Date.now()}.pdf`,
      generatedAt: new Date().toISOString(),
    };
  },

  SEND_WELCOME_EMAIL: async (payload) => {
    console.log(`[Handler] Sending welcome email to ${payload.to}...`);
    await sleep(1000);
    return {
      delivered: true,
      recipient: payload.to,
    };
  },
};

const executeJobHandler = async (type, payload) => {
  const handler = handlers[type];
  if (!handler) {
    throw new Error(`No handler registered for job type: "${type}"`);
  }
  return await handler(payload);
};

module.exports = {
  executeJobHandler,
};