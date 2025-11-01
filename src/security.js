function originAllowed(allowedOrigins, origin) {
  if (!origin) return true;
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

function authorizeHeader(authHeader, expectedToken) {
  if (!expectedToken) return true;
  const auth = authHeader || '';
  const got = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  return got === expectedToken;
}

module.exports = { originAllowed, authorizeHeader };
