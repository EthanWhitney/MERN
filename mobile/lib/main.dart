import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile/login.dart';
import 'package:mobile/app_state.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (context) => SyncordAppState(),
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Syncord',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Roboto',
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF5865F2),
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF313338),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF313338),
          foregroundColor: Colors.white,
          elevation: 0,
          titleTextStyle: TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        dialogTheme: const DialogThemeData(
          backgroundColor: Color(0xFF1F2937),
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(8)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1E1F22),
          labelStyle: const TextStyle(
            color: Color(0xFFB5BAC1),
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
          hintStyle: const TextStyle(color: Color(0xFF6D6F78)),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide.none,
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF5865F2),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF5865F2),
          ),
        ),
      ),
      home: const LoginPage(),
    );
  }
}
