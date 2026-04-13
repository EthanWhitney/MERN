// middleware/tokenMiddleware.js - JWT Token Verification
const jwtManager = require('../createJWT');
const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const bodyToken = req.body?.jwtToken;
    const jwtToken = bearerToken || bodyToken;

    if (!jwtToken) {
      return res.status(401).json({ 
        error: 'No token provided', 
        jwtToken: '' 
      });
    }

    let verifiedPayload;
    try {
      verifiedPayload = jwt.verify(jwtToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ 
        error: e.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token', 
        jwtToken: '' 
      });
    }

    // Attach user info to request
    req.user = {
      userId: verifiedPayload.userId,
      email: verifiedPayload.email,
      username: verifiedPayload.username
    };
    // Also set directly for backwards compatibility
    req.userId = verifiedPayload.userId;
    req.email = verifiedPayload.email;
    req.username = verifiedPayload.username;

    // Refresh token
    const refreshed = jwtManager.refresh(jwtToken);
    
    if (refreshed.error) {
      // Token failed to refresh but was valid, continue
      req.refreshedToken = null;
    } else {
      req.refreshedToken = refreshed.accessToken;
    }

    next();
  } catch (e) {
    return res.status(500).json({ 
      error: e.message, 
      jwtToken: '' 
    });
  }
};

// Wrapper to add refreshed token to response
exports.addRefreshedTokenToResponse = (req, res, data) => {
  if (req.refreshedToken) {
    return {
      ...data,
      jwtToken: req.refreshedToken
    };
  }
  return data;
};
