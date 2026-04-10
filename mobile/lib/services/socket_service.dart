import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:mobile/api_service.dart'; 

class SocketService {
  late IO.Socket socket;

  void connect(String userId) {
    // We use the same baseUrl from your ApiService
    socket = IO.io(ApiService.baseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'userId': userId},
    });

    socket.connect();

    socket.onConnect((_) {
      print('Connected to Socket.IO Server');
      // Tell the server which user this socket belongs to
      // Based on your backend, you likely have a 'register' or 'login' event
      socket.emit('login', userId); 
    });

    // Listen for the events found in your socketManager.js
    socket.on('friend-request-received', (data) {
      print('New friend request from: ${data['senderName']}');
      // Later: We will trigger a notification or UI update here
    });

    socket.onDisconnect((_) => print('Disconnected from Socket.IO Server'));
  }

  void disconnect() {
    socket.disconnect();
  }
}