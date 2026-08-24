import 'package:flutter_test/flutter_test.dart';
import 'package:oppo_line_oa_chat/core/models/authorization_extensions.dart';
import 'package:oppo_line_oa_chat/core/models/models.dart';

CurrentUser makeUser({
  String role = 'VIEWER',
  List<StoreMembership> memberships = const [],
  Map<String, dynamic> permissions = const {},
}) =>
    CurrentUser(
      id: 'user-1',
      displayName: 'User',
      role: role,
      memberships: memberships,
      stores: memberships.map((membership) => membership.store).toList(),
      permissions: permissions,
    );

void main() {
  test('store user reads Stage 2 workspace and reply capabilities', () {
    final store = Store(id: 'store-1', name: 'Store');
    final user = makeUser(
      memberships: [
        StoreMembership(
          id: 'membership-1',
          storeId: store.id,
          role: 'STAFF',
          store: store,
        ),
      ],
      permissions: {
        'workspaces': {'hq': false, 'store': true, 'mainOa': false},
        'scope': {
          'allStores': false,
          'storeIds': ['store-1'],
        },
        'capabilities': {
          'manageAccounts': false,
          'reply': true,
          'accessMainOa': false,
          'manageMainOa': false,
        },
      },
    );

    expect(user.canAccessStoreWorkspace, isTrue);
    expect(user.canAccessHqWorkspace, isFalse);
    expect(user.canReply, isTrue);
    expect(user.authorizedStoreIds, ['store-1']);
    expect(user.workspaceSummary, 'Store');
  });

  test('HQ account can be mobile-only without Store membership', () {
    final user = makeUser(
      permissions: {
        'workspaces': {'hq': true, 'store': false, 'mainOa': false},
        'scope': {'allStores': true, 'storeIds': <String>[]},
        'capabilities': {
          'manageAccounts': true,
          'reply': true,
          'accessMainOa': false,
          'manageMainOa': false,
        },
      },
    );

    expect(user.canAccessHqWorkspace, isTrue);
    expect(user.canAccessStoreWorkspace, isFalse);
    expect(user.canManageAccounts, isTrue);
    expect(user.canAccessAllStores, isTrue);
    expect(user.workspaceSummary, 'HQ');
  });

  test('legacy ADMIN remains compatible during rolling deployment', () {
    final user = makeUser(role: 'ADMIN');
    expect(user.canAccessHqWorkspace, isTrue);
    expect(user.canManageAccounts, isTrue);
    expect(user.canReply, isTrue);
    expect(user.canAccessAllStores, isTrue);
  });
}
