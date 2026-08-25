import 'package:flutter/material.dart';
import '../../core/models/models.dart';
import '../../core/localization/localization.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';

class AdminApprovalPage extends StatefulWidget {
  const AdminApprovalPage({super.key, required this.auth});
  final AuthRepository auth;
  @override
  State<AdminApprovalPage> createState() => _AdminApprovalPageState();
}

class _AdminApprovalPageState extends State<AdminApprovalPage> {
  List<PendingRegistration> _items = const [];
  List<PendingHqRegistration> _hqItems = const [];
  List<ApprovedHqAccount> _approvedHqItems = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        widget.auth.pendingRegistrations(),
        widget.auth.pendingHqRegistrations(),
        widget.auth.approvedHqRegistrations(),
      ]);
      _items = results[0] as List<PendingRegistration>;
      _hqItems = results[1] as List<PendingHqRegistration>;
      _approvedHqItems = results[2] as List<ApprovedHqAccount>;
    } on ApiException catch (error) {
      _error = error.message;
    } catch (_) {
      _error = 'Unable to load registrations.';
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _act(PendingRegistration item, bool approve) async {
    try {
      if (approve) {
        await widget.auth.approveRegistration(item.id);
      } else {
        await widget.auth.rejectRegistration(item.id);
      }
      await _load();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _actHq(PendingHqRegistration item, bool approve) async {
    try {
      if (approve) {
        await widget.auth.approveHqRegistration(item.id);
      } else {
        await widget.auth.rejectHqRegistration(item.id);
      }
      await _load();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _actApprovedHq(ApprovedHqAccount item) async {
    try {
      if (item.isActive) {
        await widget.auth.deactivateHqAccount(item.id);
      } else {
        await widget.auth.reactivateHqAccount(item.id);
      }
      await _load();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Widget _hqCard(PendingHqRegistration item) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(item.displayName,
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                const Chip(label: Text('HQ · Full access')),
              ],
            ),
            Text('Employee ID: ${item.employeeId ?? '—'}'),
            Text(item.email),
            const Text(
                'Web + Mobile · HQ · All Stores · Accounts · Reply · Main OA'),
            Text(item.createdAt.toLocal().toString()),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              TextButton(
                  onPressed: () => _actHq(item, false),
                  child: Text(appLocalizations(context).reject)),
              FilledButton(
                  onPressed: () => _actHq(item, true),
                  child: const Text('Approve full access')),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _storeCard(PendingRegistration item) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(item.name, style: Theme.of(context).textTheme.titleMedium),
          Text(appLocalizations(context).employeeIdValue(
              item.employeeId ?? appLocalizations(context).notSet)),
          Text(item.email),
          Text('${item.storeName} · ${item.role.replaceAll('_', ' ')}'),
          Text(item.createdAt.toLocal().toString()),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            TextButton(
                onPressed: () => _act(item, false),
                child: Text(appLocalizations(context).reject)),
            FilledButton(
                onPressed: () => _act(item, true),
                child: Text(appLocalizations(context).approve)),
          ]),
        ]),
      ),
    );
  }

  Widget _approvedHqCard(ApprovedHqAccount item) => Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(item.displayName,
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
                  Chip(
                    label: Text(item.isActive ? 'Active' : 'Inactive'),
                    backgroundColor: item.isActive
                        ? Colors.green.withValues(alpha: 0.12)
                        : Colors.grey.withValues(alpha: 0.16),
                  ),
                ],
              ),
              Text('Employee ID: ${item.employeeId ?? '—'}'),
              Text(item.email),
              Text('HQ · All Stores · Web + Mobile'),
              Text('Status: ${item.status}'),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton(
                    onPressed: () => _actApprovedHq(item),
                    child: Text(item.isActive ? 'Deactivate' : 'Reactivate'),
                  ),
                ],
              ),
            ],
          ),
        ),
      );

  Widget _pendingBody() {
    if (_items.isEmpty && _hqItems.isEmpty) {
      return Center(
          child: Text(appLocalizations(context).noPendingRegistrations));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(12),
        children: [
          if (_hqItems.isNotEmpty) ...[
            Text('HQ approvals', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            ..._hqItems.map(_hqCard),
            const SizedBox(height: 16),
          ],
          if (_items.isNotEmpty) ...[
            Text(appLocalizations(context).pendingBmRegistrations,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            ..._items.map(_storeCard),
          ],
        ],
      ),
    );
  }

  Widget _approvedBody() {
    if (_approvedHqItems.isEmpty) {
      return Center(child: Text('No approved HQ accounts'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(12),
        children: _approvedHqItems.map(_approvedHqCard).toList(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (_error != null) {
      body = Center(child: Text(_error!));
    } else {
      body = DefaultTabController(
        length: 2,
        child: Column(
          children: [
            const TabBar(
              tabs: [
                Tab(text: 'Pending approvals'),
                Tab(text: 'Approved / manage'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [_pendingBody(), _approvedBody()],
              ),
            ),
          ],
        ),
      );
    }
    return Scaffold(
        appBar: AppBar(title: const Text('Account approvals')), body: body);
  }
}
