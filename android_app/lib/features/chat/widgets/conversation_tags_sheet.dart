import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/theme/app_spacing.dart';
import '../../inbox/conversation_repository.dart';

class ConversationTagsBar extends StatelessWidget {
  const ConversationTagsBar({super.key, this.tags, required this.onPressed});

  final ConversationTags? tags;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final current = tags ?? const ConversationTags();
    if (current.isEmpty) {
      return Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: onPressed,
          icon: const Icon(Icons.sell_outlined, size: 18),
          label: const Text('+ Add tags'),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.xl, 0, AppSpacing.xl,
          AppSpacing.xs),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Row(
            children: [
              const Icon(Icons.sell_outlined, size: 17),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  _label(current),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelLarge,
                ),
              ),
              const Icon(Icons.edit_outlined, size: 16),
            ],
          ),
        ),
      ),
    );
  }

  String _label(ConversationTags value) {
    final source = switch (value.sourceChannel) {
      'STORE' => 'Store',
      'ONLINE' => 'Online',
      _ => null,
    };
    final product = value.product?.productName;
    return [if (source != null) source, if (product != null) product]
        .join(' · ');
  }
}

class ConversationTagsSheet extends StatefulWidget {
  const ConversationTagsSheet({
    super.key,
    required this.conversationId,
    required this.repository,
    required this.initialTags,
  });

  final String conversationId;
  final ConversationRepository repository;
  final ConversationTags initialTags;

  static Future<ConversationTags?> show({
    required BuildContext context,
    required String conversationId,
    required ConversationRepository repository,
    required ConversationTags initialTags,
  }) =>
      showModalBottomSheet<ConversationTags>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => ConversationTagsSheet(
          conversationId: conversationId,
          repository: repository,
          initialTags: initialTags,
        ),
      );

  @override
  State<ConversationTagsSheet> createState() => _ConversationTagsSheetState();
}

class _ConversationTagsSheetState extends State<ConversationTagsSheet> {
  late String? _sourceChannel = widget.initialTags.sourceChannel;
  late ConversationProductTag? _product = widget.initialTags.product;
  final _searchController = TextEditingController();
  List<ProductSelectorItem> _products = const [];
  bool _loadingProducts = true;
  bool _saving = false;
  String? _error;
  int _searchGeneration = 0;

  bool get _dirty =>
      _sourceChannel != widget.initialTags.sourceChannel ||
      _product?.id != widget.initialTags.product?.id;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadProducts();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProducts([String? query]) async {
    final generation = ++_searchGeneration;
    setState(() {
      _loadingProducts = true;
      _error = null;
    });
    try {
      final products = await widget.repository.fetchProducts(search: query);
      if (!mounted || generation != _searchGeneration) return;
      setState(() {
        _products = products;
        _loadingProducts = false;
      });
    } catch (_) {
      if (!mounted || generation != _searchGeneration) return;
      setState(() {
        _loadingProducts = false;
        _error = 'Unable to load products';
      });
    }
  }

  Future<void> _save() async {
    if (!_dirty || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final detail = await widget.repository.updateConversationTags(
        widget.conversationId,
        sourceChannel: _sourceChannel,
        productId: _product?.id,
      );
      if (!mounted) return;
      Navigator.of(context).pop(detail.tags ?? const ConversationTags());
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'Unable to save conversation tags';
      });
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
          padding: AppSpacing.screen,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('Conversation Tags',
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  IconButton(
                    onPressed: _saving ? null : () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                    tooltip: 'Close',
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text('Customer source',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  ChoiceChip(
                    label: const Text('Store'),
                    selected: _sourceChannel == 'STORE',
                    onSelected: _saving
                        ? null
                        : (selected) => setState(
                            () => _sourceChannel = selected ? 'STORE' : null),
                  ),
                  ChoiceChip(
                    label: const Text('Online'),
                    selected: _sourceChannel == 'ONLINE',
                    onSelected: _saving
                        ? null
                        : (selected) => setState(
                            () => _sourceChannel = selected ? 'ONLINE' : null),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Text('Product', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _searchController,
                onChanged: _loadProducts,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search product...',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              if (_product != null)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.check_circle_outline),
                    title: Text(_product!.productName),
                    subtitle: Text(_product!.seriesName),
                    trailing: IconButton(
                      tooltip: 'Clear product',
                      onPressed: _saving
                          ? null
                          : () => setState(() => _product = null),
                      icon: const Icon(Icons.clear),
                    ),
                  ),
                ),
              if (_loadingProducts)
                const Padding(
                    padding: EdgeInsets.all(AppSpacing.lg),
                    child: Center(child: CircularProgressIndicator()))
              else if (_products.isEmpty)
                const Padding(
                    padding: EdgeInsets.all(AppSpacing.md),
                    child: Text('No matching products'))
              else
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 230),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: _products.length,
                    itemBuilder: (context, index) {
                      final product = _products[index];
                      return ListTile(
                        dense: true,
                        title: Text(product.productName),
                        subtitle: Text(product.seriesName),
                        selected: _product?.id == product.id,
                        onTap: _saving
                            ? null
                            : () => setState(() {
                                  _product = ConversationProductTag(
                                    id: product.id,
                                    productName: product.productName,
                                    category: product.category,
                                    seriesName: product.seriesName,
                                  );
                                }),
                      );
                    },
                  ),
                ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sm),
                  child: Text(_error!,
                      style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  TextButton(
                    onPressed: _saving
                        ? null
                        : () => setState(() {
                              _sourceChannel = null;
                              _product = null;
                            }),
                    child: const Text('Clear'),
                  ),
                  const Spacer(),
                  FilledButton(
                    onPressed: !_dirty || _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Save'),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
}
