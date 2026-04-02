// createJWT.js - JWT Token Management
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Create JWT token
exports.createToken = function (userId, email, username) {
  return _createToken(userId, email, username);
};

_createToken = function (userId, email, username) {
  try {
    const user = { userId: userId, email: email, username: username };

    // Create token with 24h expiration
    const accessToken = jwt.sign(user, process.env.JWT_SECRET, {
      expiresIn: "24h"
    });

    return { accessToken: accessToken };
  } catch (e) {
    return { error: e.message };
  }
};

// Verify token is not expired
exports.isExpired = function (token) {
  try {
    jwt.verify(token, process.env.JWT_SECRET, (err, verifiedJwt) => {
      if (err) {
        return true;
      } else {
        return false;
      }
    });
    return false;
  } catch (e) {
    return true;
  }
};

// Refresh token
exports.refresh = function (token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      return { error: "Invalid token" };
    }

    const payload = decoded.payload;
    const userId = payload.userId;
    const email = payload.email;
    const username = payload.username;

    return _createToken(userId, email, username);
  } catch (e) {
    return { error: e.message };
  }
};

// Decode token
exports.decode = function (token) {
  try {
    return jwt.decode(token, { complete: true });
  } catch (e) {
    return { error: e.message };
  }
};
