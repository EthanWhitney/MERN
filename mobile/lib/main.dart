import 'package:flutter/material.dart';
import 'package:mobile/api_service.dart';
import 'package:mobile/home_page.dart';
import 'package:mobile/register_page.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        // This is the theme of your application.
        //
        // TRY THIS: Try running your application with "flutter run". You'll see
        // the application has a purple toolbar. Then, without quitting the app,
        // try changing the seedColor in the colorScheme below to Colors.green
        // and then invoke "hot reload" (save your changes or press the "hot
        // reload" button in a Flutter-supported IDE, or press "r" if you used
        // the command line to start the app).
        //
        // Notice that the counter didn't reset back to zero; the application
        // state is not lost during the reload. To reset the state, use hot
        // restart instead.
        //
        // This works for code too, not just values: Most code changes can be
        // tested with just a hot reload.
        colorScheme: .fromSeed(seedColor: Colors.deepPurple),
      ),
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  // This widget is the home page of your application. It is stateful, meaning
  // that it has a State object (defined below) that contains fields that affect
  // how it looks.

  // This class is the configuration for the state. It holds the values (in this
  // case the title) provided by the parent (in this case the App widget) and
  // used by the build method of the State. Fields in a Widget subclass are
  // always marked "final".

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  // 1. Place your Controllers here (at the top of the class)
  final TextEditingController _loginController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  // 2. Place your Logic function here
void _doLogin() async {
  try {
    print("Attempting to login with: ${_loginController.text}"); // Debug
    
    var result = await ApiService.login(_loginController.text, _passwordController.text);
    
    print("Server Response: $result"); // Debug

    if (!mounted) return; // Safety check for Flutter

    if (result.containsKey('error') && result['error'] != null && result['error'].isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['error']), backgroundColor: Colors.red),
      );
    } else {
      print("Success! Token: ${result['accessToken']}");
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Login Successful! Welcome to Syncord.")),
      );
      
      // Move to next screen here
      Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (context) => HomePage(username: _loginController.text),
      ),
  );
    }
  } catch (e) {
    print("Crashed with error: $e"); // This will show in your terminal!
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("Connection failed. Is the backend running?")),
    );
  }
}

  @override
Widget build(BuildContext context) {
  return Scaffold(
    // Setting a background color similar to Discord's dark theme
    backgroundColor: const Color(0xFF111827), 
    body: Center(
      child: SingleChildScrollView( // Prevents errors when the keyboard pops up
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Branding / Logo area
              //Image.asset('assets/syncord_logo.png', height: 80), // If an asset, it needs an actual file, duh
              //const Icon(Icons.groups_rounded, size: 80, color: Color(0xFF5865F2)),
              const Icon(Icons.forum_rounded, size: 80, color: Color(0xFF5865F2)),
              const SizedBox(height: 16),
              const Text(
                "Welcome back!",
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                "We're so excited to see you again!",
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFFB5BAC1), fontSize: 14),
              ),
              const SizedBox(height: 32),

              // Input Fields
              _buildTextField(
                label: "EMAIL OR USERNAME",
                controller: _loginController,
              ),
              const SizedBox(height: 20),
              _buildTextField(
                label: "PASSWORD",
                controller: _passwordController,
                isPassword: true,
              ),
              
              const SizedBox(height: 24),

              // The Login Button
              ElevatedButton(
                onPressed: _doLogin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF374151),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  "Log In",
                  style: TextStyle(color: Colors.white, fontSize: 16),
                ),
              ),

              TextButton(
               onPressed: () {
                 Navigator.push(
                   context,
                   MaterialPageRoute(builder: (context) => const RegisterPage()),
                 );
                },
               child: const Text("Need an account? Register", 
                 style: TextStyle(color: Color(0xFF5865F2))),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

// A helper widget to keep the code clean and consistent
Widget _buildTextField({
  required String label,
  required TextEditingController controller,
  bool isPassword = false,
}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          color: Color(0xFFB5BAC1),
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
      const SizedBox(height: 8),
      TextField(
        controller: controller,
        obscureText: isPassword,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          filled: true,
          fillColor: const Color(0xFF1E1F22), // Input background
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    ],
  );
}
}