import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/api_service.dart';
import 'package:mobile/models/server_model.dart';

enum ViewMode { server, dm }

class SyncordAppState extends ChangeNotifier {
  List<ServerModel> _servers = [];
  ViewMode _currentMode = ViewMode.dm; // Default to DM/Friends view like Discord
  ServerModel? _selectedServer;

  List<ServerModel> get servers => _servers;
  ViewMode get currentMode => _currentMode;
  ServerModel? get selectedServer => _selectedServer;

  void setViewMode(ViewMode mode) {
    _currentMode = mode;
    if (mode == ViewMode.dm) _selectedServer = null;
    notifyListeners();
  }

  void selectServer(ServerModel server) {
    _selectedServer = server;
    _currentMode = ViewMode.server;
    notifyListeners();
  }

  Future<void> loadServers() async {
    final prefs = await SharedPreferences.getInstance();
    final String userId = prefs.getString('userId') ?? 'NO_ID_FOUND';
    debugPrint("Attempting to load servers for User ID: $userId");
    try {
      final response = await ApiService.getServers();
      _servers = response.map((s) => ServerModel.fromJson(s)).toList();
      notifyListeners();
    } catch (e) {
      print("State Error: $e");
    }
  }


  Future<void> createServer(String name) async {
    print("DEBUG: Inside appState.createServer for: $name");
    try {
      final result = await ApiService.createServer(name);
      print("DEBUG: ApiService returned: $result");

      if (result.containsKey('error')) {
        print("STATE ERROR: API returned an error: ${result['error']}");
        throw result['error'];
      }
      
      // Crucial: Reload servers so the new one appears in the list
      await loadServers(); 
      notifyListeners(); 
      print("STATE: notifyListeners called.");
    } catch (e) {
      print("STATE ERROR: Exception caught: $e");
      rethrow;
    }
  }

  Future<void> addFriend(String username) async {
    try {
      final result = await ApiService.addFriend(username);
      if (result.containsKey('error')) throw result['error'];
      
      // You might want to refresh a friend list here later
      notifyListeners();
    } catch (e) {
      print("Add Friend Error: $e");
      rethrow;
    }
  }
}