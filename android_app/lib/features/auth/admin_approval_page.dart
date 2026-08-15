import 'package:flutter/material.dart';
import '../../core/models/models.dart';
import '../../core/network/api_exception.dart';
import 'auth_repository.dart';

class AdminApprovalPage extends StatefulWidget {
  const AdminApprovalPage({super.key, required this.auth});
  final AuthRepository auth;
  @override State<AdminApprovalPage> createState() => _AdminApprovalPageState();
}

class _AdminApprovalPageState extends State<AdminApprovalPage> {
  List<PendingRegistration> _items = const []; bool _loading = true; String? _error;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { setState(() { _loading = true; _error = null; }); try { _items = await widget.auth.pendingRegistrations(); } on ApiException catch (error) { _error = error.message; } catch (_) { _error = 'Unable to load registrations.'; } if (mounted) setState(() => _loading = false); }
  Future<void> _act(PendingRegistration item, bool approve) async { try { if (approve) { await widget.auth.approveRegistration(item.id); } else { await widget.auth.rejectRegistration(item.id); } await _load(); } on ApiException catch (error) { if (mounted) setState(() => _error = error.message); } }
  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (_error != null) {
      body = Center(child: Text(_error!));
    } else if (_items.isEmpty) {
      body = const Center(child: Text('No pending registrations.'));
    } else {
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          itemCount: _items.length,
          itemBuilder: (_, index) {
            final item = _items[index];
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(item.name, style: Theme.of(context).textTheme.titleMedium),
                  Text(item.email),
                  Text('${item.storeName} · ${item.role.replaceAll('_', ' ')}'),
                  Text(item.createdAt.toLocal().toString()),
                  Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                    TextButton(onPressed: () => _act(item, false), child: const Text('Reject')),
                    FilledButton(onPressed: () => _act(item, true), child: const Text('Approve')),
                  ]),
                ]),
              ),
            );
          },
        ),
      );
    }
    return Scaffold(appBar: AppBar(title: const Text('Pending BM registrations')), body: body);
  }
}
