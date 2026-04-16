/// Central configuration for API and WebSocket endpoints.
///
/// In debug builds the app targets local emulator/simulator addresses so
/// you can run the backend with `npm start` on your dev machine.
/// In release builds (or when [forceProduction] is true) it targets the
/// live domain.
///
/// To point a debug build at production temporarily, flip [forceProduction].

import 'package:flutter/foundation.dart';
import 'dart:io';

class AppConfig {
  AppConfig._();

  // ── Toggle this to `true` to hit the live server from a debug build ───────
  static const bool forceProduction = false;

  static bool get _useProduction => !kDebugMode || forceProduction;

  // ── Production ─────────────────────────────────────────────────────────────
  /// HTTPS base URL — Nginx terminates SSL and proxies /api/* to the backend.
  static const String _productionBaseUrl = 'https://syncord.space';

  // ── Local development ──────────────────────────────────────────────────────
  /// Android emulator: 10.0.2.2 routes to the host machine's localhost.
  /// iOS simulator and desktop: regular localhost.
  static String get _devBaseUrl {
    if (kIsWeb) return 'http://localhost:5000';
    if (Platform.isAndroid) return 'http://10.0.2.2:5000';
    return 'http://localhost:5000';
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Base URL for all REST API calls, e.g. `https://syncord.space`.
  static String get baseUrl =>
      _useProduction ? _productionBaseUrl : _devBaseUrl;

  /// Build a full API path, e.g. `buildPath('api/auth/login')`.
  static String buildPath(String path) {
    final clean = path.startsWith('/') ? path.substring(1) : path;
    return '$baseUrl/$clean';
  }

  /// WebSocket URL — same host, Nginx proxies the socket.io upgrade.
  /// In production this is wss:// (secure); in dev it's plain ws://.
  static String get socketUrl => baseUrl;
}
