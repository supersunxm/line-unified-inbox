import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/authorization_extensions.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';

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

  test('conversation store context follows canonical accessible stores', () {
    StoreMembership membership(String id) => StoreMembership(
          id: 'membership-$id',
          storeId: id,
          role: 'STAFF',
          store: Store(id: id, name: 'Store $id'),
        );

    final single = makeUser(memberships: [membership('store-1')]);
    expect(single.hasSingleStorePresentationScope, isTrue);
    expect(single.shouldShowConversationStoreContext, isFalse);

    final multi =
        makeUser(memberships: [membership('store-1'), membership('store-2')]);
    expect(multi.hasSingleStorePresentationScope, isFalse);
    expect(multi.shouldShowConversationStoreContext, isTrue);

    final hq = makeUser(permissions: {
      'workspaces': {'hq': true},
      'scope': {'allStores': true},
    });
    expect(hq.hasSingleStorePresentationScope, isFalse);
    expect(hq.shouldShowConversationStoreContext, isTrue);

    final unresolved = makeUser();
    expect(unresolved.hasSingleStorePresentationScope, isFalse);
    expect(unresolved.shouldShowConversationStoreContext, isTrue);
  });
}
