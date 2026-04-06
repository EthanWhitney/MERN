// createJWT.js - JWT Token Management
const jwt = require("jsonwebtoken");
require("dotenv").config();

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

// Create JWT token
exports.createToken = function (userId, email, username) {
  return _createToken(userId, email, username);
};

// Create access + refresh token pair
exports.createTokenPair = function (userId, email, username) {
  return _createTokenPair(userId, email, username);
};

_createToken = function (userId, email, username) {
  try {
    const user = { userId: userId, email: email, username: username };

    // Create short-lived access token
    const accessToken = jwt.sign(user, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN
    });

    return { accessToken: accessToken };
  } catch (e) {
    return { error: e.message };
  }
};

_createTokenPair = function (userId, email, username) {
  try {
    const accessPayload = { userId: userId, email: email, username: username };
    const refreshPayload = { userId: userId };

    const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(refreshPayload, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    return { accessToken, refreshToken };
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

// Refresh from refresh token (returns a new token pair)
exports.refreshFromRefreshToken = function (refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    if (!payload || !payload.userId) {
      return { error: "Invalid refresh token" };
    }

    return { userId: payload.userId };
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
