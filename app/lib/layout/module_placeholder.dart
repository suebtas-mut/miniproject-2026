import 'package:flutter/material.dart';

/// หน้า placeholder ชั่วคราวของแต่ละโมดูล จนกว่าจะทำหน้าจริงใน Sprint ถัดไป
class ModulePlaceholder extends StatelessWidget {
  const ModulePlaceholder({
    super.key,
    required this.title,
    required this.description,
    this.sprintHint,
  });

  final String title;
  final String description;
  final String? sprintHint;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.construction, size: 48, color: theme.colorScheme.primary),
                    const SizedBox(height: 16),
                    Text(title, style: theme.textTheme.titleLarge),
                    const SizedBox(height: 8),
                    Text(description, textAlign: TextAlign.center),
                    if (sprintHint != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        sprintHint!,
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: theme.colorScheme.outline),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
