// middleware/tokenMiddleware.js - JWT Token Verification
const jwtManager = require('../createJWT');

exports.verifyToken = (req, res, next) => {
  try {
    const { jwtToken } = req.body;

    if (!jwtToken) {
      return res.status(401).json({ 
        error: 'No token provided', 
        jwtToken: '' 
      });
    }

    // Check if token is expired
    if (jwtManager.isExpired(jwtToken)) {
      return res.status(401).json({ 
        error: 'Token has expired', 
        jwtToken: '' 
      });
    }

    // Decode token to get user info
    const decoded = jwtManager.decode(jwtToken);
    
    if (!decoded || decoded.error) {
      return res.status(401).json({ 
        error: 'Invalid token', 
        jwtToken: '' 
      });
    }

    // Attach user info to request
    req.userId = decoded.payload.userId;
    req.email = decoded.payload.email;
    req.username = decoded.payload.username;

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
