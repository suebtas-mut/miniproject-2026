import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth_controller.dart';

class AccountMenu extends ConsumerWidget {
  const AccountMenu({super.key});

  static const String changePasswordValue = 'change-password';
  static const String logoutValue = 'logout';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(
      authControllerProvider.select((state) => state.user),
    );
    return PopupMenuButton<String>(
      key: const Key('account-menu'),
      tooltip: 'บัญชีผู้ใช้',
      icon: const Icon(Icons.account_circle_outlined),
      itemBuilder: (context) => [
        PopupMenuItem<String>(
          enabled: false,
          child: Text(
            user == null ? 'ผู้ใช้' : user.fullName,
            style: Theme.of(context).textTheme.labelLarge,
          ),
        ),
        const PopupMenuItem<String>(
          value: changePasswordValue,
          child: Row(
            children: [
              Icon(Icons.lock_reset_outlined, size: 20),
              SizedBox(width: 12),
              Text('เปลี่ยนรหัสผ่าน'),
            ],
          ),
        ),
        const PopupMenuItem<String>(
          value: logoutValue,
          child: Row(
            children: [
              Icon(Icons.logout, size: 20),
              SizedBox(width: 12),
              Text('ออกจากระบบ'),
            ],
          ),
        ),
      ],
      onSelected: (value) async {
        switch (value) {
          case changePasswordValue:
            context.push('/account/change-password');
          case logoutValue:
            await ref.read(authControllerProvider.notifier).logout();
        }
      },
    );
  }
}
