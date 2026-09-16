import 'package:flutter/material.dart';

import '../../core/models/models.dart';
import 'store_view_repository.dart';

Future<Store?> showStoreViewPicker(
  BuildContext context, {
  required StoreViewRepository repository,
  Store? selectedStore,
}) {
  return showModalBottomSheet<Store>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => FractionallySizedBox(
      heightFactor: 0.86,
      child: _StoreViewPicker(
        repository: repository,
        selectedStore: selectedStore,
      ),
    ),
  );
}

class _StoreViewPicker extends StatefulWidget {
  const _StoreViewPicker({
    required this.repository,
    required this.selectedStore,
  });

  final StoreViewRepository repository;
  final Store? selectedStore;

  @override
  State<_StoreViewPicker> createState() => _StoreViewPickerState();
}

class _StoreViewPickerState extends State<_StoreViewPicker> {
  late Future<List<Store>> _stores;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _stores = widget.repository.stores();
  }

  void _retry() => setState(() => _stores = widget.repository.stores());

  List<Store> _filtered(List<Store> stores) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return stores;
    return stores
        .where((store) =>
            store.name.toLowerCase().contains(query) ||
            store.id.toLowerCase().contains(query) ||
            (store.code?.toLowerCase().contains(query) ?? false))
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.selectedStore == null
                        ? 'เข้าสู่มุมมองสาขา'
                        : 'เปลี่ยนสาขา',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'ปิด',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: TextField(
              autofocus: true,
              onChanged: (value) => setState(() => _query = value),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'ค้นหาชื่อร้าน หรือ Store ID',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<Store>>(
              future: _stores,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('โหลดรายชื่อสาขาไม่สำเร็จ'),
                        const SizedBox(height: 12),
                        FilledButton.tonal(
                          onPressed: _retry,
                          child: const Text('ลองใหม่'),
                        ),
                      ],
                    ),
                  );
                }
                final stores = _filtered(snapshot.data ?? const []);
                if (stores.isEmpty) {
                  return const Center(child: Text('ไม่พบสาขาที่ค้นหา'));
                }
                return ListView.separated(
                  itemCount: stores.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final store = stores[index];
                    final selected = widget.selectedStore?.id == store.id;
                    return ListTile(
                      leading: const CircleAvatar(
                        child: Icon(Icons.storefront_outlined),
                      ),
                      title: Text(store.name),
                      subtitle: Text(
                        store.code?.trim().isNotEmpty == true
                            ? '${store.code} · ${store.id}'
                            : 'Store ID: ${store.id}',
                      ),
                      trailing: selected
                          ? Icon(Icons.check_circle,
                              color: theme.colorScheme.primary)
                          : const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context).pop(store),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
