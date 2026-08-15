import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/localization/localization.dart';
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
          label: Text(appLocalizations(context).addTags),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.xs),
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
                  _label(context, current),
                  maxLines: 2,
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

  String _label(BuildContext context, ConversationTags value) {
    final sources = value.sourceChannels.map((source) => switch (source) {
          'STORE' => appLocalizations(context).store,
          'ONLINE' => appLocalizations(context).online,
          _ => source,
        });
    final parts = [
      ...sources,
      if (value.product != null) value.product!.productName,
      if (value.variant?.label.isNotEmpty == true) value.variant!.label,
      if (value.isInstallment)
        '💳 ${appLocalizations(context).installment}',
    ];
    return parts.join(' · ');
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
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width,
        ),
        backgroundColor: Theme.of(context).colorScheme.surface,
        builder: (_) => SizedBox(
          width: MediaQuery.sizeOf(context).width,
          height: MediaQuery.sizeOf(context).height * .8,
          child: ConversationTagsSheet(
            conversationId: conversationId,
            repository: repository,
            initialTags: initialTags,
          ),
        ),
      );

  @override
  State<ConversationTagsSheet> createState() => _ConversationTagsSheetState();
}

class _ConversationTagsSheetState extends State<ConversationTagsSheet> {
  late Set<String> _sourceChannels = widget.initialTags.sourceChannels.toSet();
  late bool _isInstallment = widget.initialTags.isInstallment;
  late ConversationProductTag? _product = widget.initialTags.product;
  late ConversationProductVariant? _variant = widget.initialTags.variant;
  final _searchController = TextEditingController();
  List<ProductSelectorItem> _products = const [];
  List<ProductVariantSelectorItem> _variants = const [];
  bool _loadingProducts = true;
  bool _loadingVariants = false;
  bool _saving = false;
  String? _error;
  int _searchGeneration = 0;
  int _variantGeneration = 0;

  bool get _dirty =>
      !_sameSources(
          _sourceChannels, widget.initialTags.sourceChannels.toSet()) ||
      _isInstallment != widget.initialTags.isInstallment ||
      _product?.id != widget.initialTags.product?.id ||
      _variant?.id != widget.initialTags.variant?.id;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _loadProducts();
      if (_product != null) _loadVariants(_product!.id);
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
        _error = appLocalizations(context).unableToLoadProducts;
      });
    }
  }

  Future<void> _loadVariants(String productId) async {
    final generation = ++_variantGeneration;
    setState(() {
      _loadingVariants = true;
      _variants = const [];
      _error = null;
    });
    try {
      final variants = await widget.repository.fetchProductVariants(productId);
      if (!mounted || generation != _variantGeneration) return;
      setState(() {
        _variants = variants;
        _loadingVariants = false;
        if (_variant != null &&
            !_variants.any((candidate) => candidate.id == _variant!.id)) {
          _variant = null;
        }
      });
    } catch (_) {
      if (!mounted || generation != _variantGeneration) return;
      setState(() {
        _loadingVariants = false;
        _error = 'Unable to load product variants';
      });
    }
  }

  void _selectProduct(ProductSelectorItem product) {
    setState(() {
      _product = ConversationProductTag(
        id: product.id,
        productName: product.productName,
        category: product.category,
        seriesName: product.seriesName,
      );
      _variant = null;
    });
    _loadVariants(product.id);
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
        sourceChannels: _sourceChannels.toList(),
        isInstallment: _isInstallment,
        productId: _product?.id,
        variantId: _variant?.id,
      );
      if (!mounted) return;
      Navigator.of(context).pop(detail.tags ?? const ConversationTags());
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = appLocalizations(context).unableToSaveTags;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.sizeOf(context).width;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: screenWidth,
          child: Padding(
            padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(context).bottom),
            child: SingleChildScrollView(
              padding: AppSpacing.screen,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: AppSpacing.sm,
                    children: [
                      Text('Conversation Tags',
                          style: Theme.of(context).textTheme.titleLarge),
                      IconButton(
                        onPressed:
                            _saving ? null : () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                        tooltip: 'Close',
                      ),
                      TextButton(
                        onPressed: _saving
                            ? null
                            : () => setState(() {
                                  _sourceChannels = <String>{};
                                  _isInstallment = false;
                                  _product = null;
                                  _variant = null;
                                  _variants = const [];
                                }),
                        child: const Text('Clear all'),
                      ),
                      FilledButton(
                        onPressed: !_dirty || _saving ? null : _save,
                        child: _saving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(appLocalizations(context).save),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(appLocalizations(context).customerSource,
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    children: [
                      FilterChip(
                        label: Text(appLocalizations(context).store),
                        selected: _sourceChannels.contains('STORE'),
                        onSelected: _saving
                            ? null
                            : (selected) => setState(() {
                                  if (selected) {
                                    _sourceChannels.add('STORE');
                                  } else {
                                    _sourceChannels.remove('STORE');
                                  }
                                }),
                      ),
                      FilterChip(
                        label: Text(appLocalizations(context).online),
                        selected: _sourceChannels.contains('ONLINE'),
                        onSelected: _saving
                            ? null
                            : (selected) => setState(() {
                                  if (selected) {
                                    _sourceChannels.add('ONLINE');
                                  } else {
                                    _sourceChannels.remove('ONLINE');
                                  }
                                }),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(appLocalizations(context).interest,
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.sm),
                  FilterChip(
                    label: Text(
                        'ผ่อน / ${appLocalizations(context).installment}'),
                    selected: _isInstallment,
                    onSelected: _saving
                        ? null
                        : (selected) =>
                            setState(() => _isInstallment = selected),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text('Product',
                      style: Theme.of(context).textTheme.titleMedium),
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
                              : () => setState(() {
                                    _product = null;
                                    _variant = null;
                                    _variants = const [];
                                  }),
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
                            onTap:
                                _saving ? null : () => _selectProduct(product),
                          );
                        },
                      ),
                    ),
                  if (_product != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text('Configuration',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.sm),
                    if (_loadingVariants)
                      const Center(child: CircularProgressIndicator())
                    else if (_variants.isEmpty)
                      const Text('No variants available for this product')
                    else
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 230),
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: _variants.length,
                          itemBuilder: (context, index) {
                            final variant = _variants[index];
                            return ListTile(
                              dense: true,
                              leading: Icon(
                                _variant?.id == variant.id
                                    ? Icons.radio_button_checked
                                    : Icons.radio_button_unchecked,
                              ),
                              title: Text(variant.label),
                              selected: _variant?.id == variant.id,
                              onTap: _saving
                                  ? null
                                  : () => setState(() => _variant = variant),
                            );
                          },
                        ),
                      ),
                    if (_variant != null)
                      TextButton.icon(
                        onPressed: _saving
                            ? null
                            : () => setState(() => _variant = null),
                        icon: const Icon(Icons.clear),
                        label: const Text('Clear variant'),
                      ),
                  ],
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.sm),
                      child: Text(_error!,
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error)),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  bool _sameSources(Set<String> a, Set<String> b) =>
      a.length == b.length && a.containsAll(b);
}
