import 'models.dart';

extension CurrentUserAuthorization on CurrentUser {
  Map<String, dynamic> get _workspaces =>
      permissions['workspaces'] is Map<String, dynamic>
          ? permissions['workspaces'] as Map<String, dynamic>
          : <String, dynamic>{};

  Map<String, dynamic> get _capabilities =>
      permissions['capabilities'] is Map<String, dynamic>
          ? permissions['capabilities'] as Map<String, dynamic>
          : <String, dynamic>{};

  Map<String, dynamic> get _scope => permissions['scope'] is Map<String, dynamic>
      ? permissions['scope'] as Map<String, dynamic>
      : <String, dynamic>{};

  bool get canAccessHqWorkspace =>
      _workspaces['hq'] == true || role == 'ADMIN';

  bool get canAccessStoreWorkspace =>
      _workspaces['store'] == true || memberships.isNotEmpty;

  bool get canAccessMainOaWorkspace =>
      _workspaces['mainOa'] == true || permissions['canAccessMainOa'] == true;

  bool get canManageAccounts =>
      _capabilities['manageAccounts'] == true ||
      permissions['canManageAccounts'] == true ||
      role == 'ADMIN';

  bool get canReply =>
      _capabilities['reply'] == true ||
      permissions['canReply'] == true ||
      role == 'ADMIN';

  bool get canAccessAllStores =>
      _scope['allStores'] == true ||
      permissions['canAccessAllStores'] == true ||
      role == 'ADMIN';

  List<String> get authorizedStoreIds {
    final raw = _scope['storeIds'];
    if (raw is List) return raw.whereType<String>().toList(growable: false);
    return memberships.map((membership) => membership.storeId).toList(growable: false);
  }

  String get workspaceSummary {
    final workspaces = <String>[
      if (canAccessHqWorkspace) 'HQ',
      if (canAccessStoreWorkspace) 'Store',
      if (canAccessMainOaWorkspace) 'Main OA',
    ];
    return workspaces.isEmpty ? 'No workspace' : workspaces.join(' + ');
  }
}
