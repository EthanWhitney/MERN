import 'package:flutter/material.dart';

class HomePage extends StatelessWidget {
  final String username;
  const HomePage({super.key, required this.username});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF111827), // Your Figma background
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0F1A),
        title: const Text("Syncord Hub"),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline, size: 100, color: Colors.green),
            const SizedBox(height: 20),
            Text(
              "Welcome, $username!",
              style: const TextStyle(color: Colors.white, fontSize: 24),
            ),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: () {
               // 🚪 The "Clean" Logout
               Navigator.pushNamedAndRemoveUntil(
                  context, 
                 '/',          // Go back to the very start (Login)
                 (route) => false // This line deletes all previous screens from memory
               );
             },
             style: ElevatedButton.styleFrom(
               backgroundColor: Colors.redAccent, // Optional: Makes logout look distinct
               minimumSize: const Size(200, 50),
             ),
              child: const Text("Logout"),
            )
          ],
        ),
      ),
    );
  }
}