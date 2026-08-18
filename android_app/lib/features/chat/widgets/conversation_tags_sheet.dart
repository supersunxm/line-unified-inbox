import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/localization/localization.dart';
import '../../../core/theme/app_spacing.dart';
import '../../inbox/conversation_repository.dart';

class ConversationTagsBar extends StatelessWidget {
  const ConversationTagsBar({
    super.key,
    this.tags,
    this.customerSalesInformation,
    this.purchaseInformation,
    required this.onPressed,
  });

  final ConversationTags? tags;
  final CustomerSalesInformation? customerSalesInformation;
  final PurchaseInformation? purchaseInformation;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final sales = customerSalesInformation;
    final current = tags ?? const ConversationTags();
    final hasSalesData = sales != null && !sales.isEmpty;
    final hasProvenance = sales?.recordedBy?.trim().isNotEmpty == true ||
        sales?.recordedAt != null ||
        purchaseInformation?.recordedBy?.trim().isNotEmpty == true ||
        purchaseInformation?.recordedAt != null;

    final isLegacy = !hasSalesData && purchaseInformation?.recordState == 'LEGACY_MANUAL';

    if (!hasSalesData && current.isEmpty && !isLegacy && !hasProvenance) {
      return Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: onPressed,
          icon: const Icon(Icons.sell_outlined, size: 18),
          label: Text(appLocalizations(context).customerSalesInformation),
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
              Icon(
                sales?.isPurchased == true
                    ? Icons.shopping_bag_outlined
                    : Icons.flag_outlined,
                size: 17,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isLegacy)
                      Text(
                        appLocalizations(context).noPurchaseInformation,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                    if (hasSalesData)
                      Text(
                        _salesLabel(context, sales),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelLarge,
                      )
                    else if (!current.isEmpty)
                      Text(
                        _legacyTagsLabel(context, current),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                    if (hasProvenance)
                      Text(
                        _provenanceLabel(context, sales, purchaseInformation),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
              const Icon(Icons.edit_outlined, size: 16),
            ],
          ),
        ),
      ),
    );
  }

  String _salesLabel(BuildContext context, CustomerSalesInformation sales) {
    final statusPrefix = sales.isPurchased
        ? '🛍️ ${appLocalizations(context).statusPurchased}'
        : '🎯 ${appLocalizations(context).statusInterested}';

    final parts = <String>[statusPrefix];

    if (sales.isInterested && sales.interestLevel != null) {
      final level = switch (sales.interestLevel) {
        'HOT' => '🔥 ${appLocalizations(context).interestHot}',
        'WARM' => '⚡ ${appLocalizations(context).interestWarm}',
        'COLD' => '❄️ ${appLocalizations(context).interestCold}',
        _ => sales.interestLevel!,
      };
      parts.add(level);
    }

    if (sales.products.isNotEmpty) {
      final productNames = sales.products.map((p) {
        final qty = p.quantity > 1 ? ' (x${p.quantity})' : '';
        return '${p.modelName}$qty';
      }).join(', ');
      parts.add('📱 $productNames');
    }

    if (sales.isPurchased) {
      for (final src in sales.purchaseChannel) {
        parts.add(switch (src) {
          'STORE' => '🏪 ${appLocalizations(context).store}',
          'ONLINE' => '🌐 ${appLocalizations(context).online}',
          _ => src,
        });
      }
      if (sales.paymentMethod != null) {
        parts.add(switch (sales.paymentMethod) {
          'INSTALLMENT' => '💳 ${appLocalizations(context).installment}',
          'CASH' => '💵 ${appLocalizations(context).paymentCash}',
          'CREDIT_CARD' => '💳 ${appLocalizations(context).paymentCreditCard}',
          'OTHER' => '🏷️ ${appLocalizations(context).paymentOther}',
          _ => sales.paymentMethod!,
        });
      }
    }

    return parts.join(' · ');
  }

  String _legacyTagsLabel(BuildContext context, ConversationTags value) {
    final sources = value.sourceChannels.map((source) => switch (source) {
          'STORE' => '🏪 ${appLocalizations(context).store}',
          'ONLINE' => '🌐 ${appLocalizations(context).online}',
          _ => source,
        });
    final parts = [
      ...sources,
      if (value.isInstallment) '💳 ${appLocalizations(context).installment}',
      if (value.product != null) '📱 ${value.product!.productName}',
      if (value.variant?.label.isNotEmpty == true) value.variant!.label,
    ];
    return '${appLocalizations(context).customerSalesInformation}: ${parts.join(' · ')}';
  }

  String _provenanceLabel(BuildContext context, CustomerSalesInformation? sales, PurchaseInformation? purchase) {
    final parts = <String>[];
    final recordedBy = sales?.recordedBy?.trim().isNotEmpty == true
        ? sales!.recordedBy!.trim()
        : purchase?.recordedBy?.trim();
    final recordedAt = sales?.recordedAt ?? purchase?.recordedAt;

    if (recordedBy?.isNotEmpty == true) {
      parts.add('${appLocalizations(context).recordedBy}: $recordedBy');
    }
    if (recordedAt != null) {
      final date = MaterialLocalizations.of(context).formatMediumDate(recordedAt.toLocal());
      final time = MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(recordedAt.toLocal()));
      parts.add('${appLocalizations(context).recordedAt}: $date $time');
    }
    return parts.join(' · ');
  }
}

class ConversationTagsSheet extends StatefulWidget {
  const ConversationTagsSheet({
    super.key,
    required this.conversationId,
    required this.repository,
    required this.initialTags,
    this.initialSalesInfo,
    this.initialPurchaseInfo,
  });

  final String conversationId;
  final ConversationRepository repository;
  final ConversationTags initialTags;
  final CustomerSalesInformation? initialSalesInfo;
  final PurchaseInformation? initialPurchaseInfo;

  static Future<ConversationDetail?> show({
    required BuildContext context,
    required String conversationId,
    required ConversationRepository repository,
    required ConversationTags initialTags,
    CustomerSalesInformation? initialSalesInfo,
    PurchaseInformation? initialPurchaseInfo,
  }) =>
      showModalBottomSheet<ConversationDetail>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width,
        ),
        backgroundColor: Theme.of(context).colorScheme.surface,
        builder: (_) => SizedBox(
          width: MediaQuery.sizeOf(context).width,
          height: MediaQuery.sizeOf(context).height * .88,
          child: ConversationTagsSheet(
            conversationId: conversationId,
            repository: repository,
            initialTags: initialTags,
            initialSalesInfo: initialSalesInfo,
            initialPurchaseInfo: initialPurchaseInfo,
          ),
        ),
      );

  @override
  State<ConversationTagsSheet> createState() => _ConversationTagsSheetState();
}

class _ConversationTagsSheetState extends State<ConversationTagsSheet> {
  late String _status; // 'INTERESTED' or 'PURCHASED'
  late String? _interestLevel;
  late Set<String> _sourceChannels;
  late String? _paymentMethod;
  late List<CustomerSalesProductItem> _selectedProducts;

  final _searchController = TextEditingController();
  List<ProductSelectorItem> _catalogProducts = const [];
  List<ProductVariantSelectorItem> _catalogVariants = const [];
  ProductSelectorItem? _addingProduct;
  ProductVariantSelectorItem? _addingVariant;
  int _addingQuantity = 1;

  bool _loadingProducts = false;
  bool _loadingVariants = false;
  bool _saving = false;
  bool _showProductPicker = false;
  String? _error;
  String? _variantError;
  int _searchGeneration = 0;
  int _variantGeneration = 0;

  @override
  void initState() {
    super.initState();
    final sales = widget.initialSalesInfo;
    if (sales != null && !sales.isEmpty) {
      _status = sales.status ?? 'INTERESTED';
      _interestLevel = sales.interestLevel ?? 'HOT';
      _sourceChannels = sales.purchaseChannel.toSet();
      _paymentMethod = sales.paymentMethod;
      _selectedProducts = List.from(sales.products);
    } else {
      // Fallback from legacy tags if present
      final tags = widget.initialTags;
      if (tags.product != null || tags.isInstallment || tags.sourceChannels.isNotEmpty) {
        _status = 'PURCHASED';
        _interestLevel = null;
        _sourceChannels = tags.sourceChannels.toSet();
        _paymentMethod = tags.isInstallment ? 'INSTALLMENT' : null;
        _selectedProducts = tags.product != null
            ? [
                CustomerSalesProductItem(
                  id: tags.product!.id,
                  productModelId: tags.product!.id,
                  productVariantId: tags.variant?.id,
                  modelName: tags.product!.productName,
                  seriesName: tags.product!.seriesName,
                  category: tags.product!.category,
                  ram: tags.variant?.ram,
                  rom: tags.variant?.rom,
                  color: tags.variant?.color,
                  quantity: 1,
                  status: 'PURCHASED',
                )
              ]
            : [];
      } else {
        _status = 'INTERESTED';
        _interestLevel = 'HOT';
        _sourceChannels = <String>{};
        _paymentMethod = null;
        _selectedProducts = [];
      }
    }
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
        _catalogProducts = products;
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
      _catalogVariants = const [];
      _variantError = null;
    });
    try {
      final variants = await widget.repository.fetchProductVariants(productId);
      if (!mounted || generation != _variantGeneration) return;
      setState(() {
        _catalogVariants = variants;
        _loadingVariants = false;
        if (_addingVariant != null &&
            !_catalogVariants.any((candidate) => candidate.id == _addingVariant!.id)) {
          _addingVariant = null;
        }
      });
    } catch (_) {
      if (!mounted || generation != _variantGeneration) return;
      setState(() {
        _loadingVariants = false;
        _variantError = appLocalizations(context).unableToLoadConfigurations;
      });
    }
  }

  void _openAddProduct() {
    setState(() {
      _showProductPicker = true;
      _addingProduct = null;
      _addingVariant = null;
      _addingQuantity = 1;
      _searchController.clear();
    });
    _loadProducts();
  }

  void _selectProduct(ProductSelectorItem product) {
    setState(() {
      _addingProduct = product;
      _addingVariant = null;
      _variantError = null;
    });
    _loadVariants(product.id);
  }

  void _confirmAddProduct() {
    if (_addingProduct == null) return;
    final item = CustomerSalesProductItem(
      id: '',
      productModelId: _addingProduct!.id,
      productVariantId: _addingVariant?.id,
      modelName: _addingProduct!.productName,
      seriesName: _addingProduct!.seriesName,
      category: _addingProduct!.category,
      ram: _addingVariant?.ram,
      rom: _addingVariant?.rom,
      color: _addingVariant?.color,
      quantity: _addingQuantity,
      status: _status,
    );

    setState(() {
      _selectedProducts.add(item);
      _showProductPicker = false;
      _addingProduct = null;
      _addingVariant = null;
      _addingQuantity = 1;
    });
  }

  void _removeProduct(int index) {
    setState(() {
      _selectedProducts.removeAt(index);
    });
  }

  void _updateQuantity(int index, int delta) {
    final current = _selectedProducts[index];
    final nextQty = (current.quantity + delta).clamp(1, 99);
    setState(() {
      _selectedProducts[index] = CustomerSalesProductItem(
        id: current.id,
        productModelId: current.productModelId,
        productVariantId: current.productVariantId,
        modelName: current.modelName,
        seriesName: current.seriesName,
        category: current.category,
        ram: current.ram,
        rom: current.rom,
        color: current.color,
        quantity: nextQty,
        status: current.status,
      );
    });
  }

  void _clearAll() {
    setState(() {
      _status = 'INTERESTED';
      _interestLevel = 'HOT';
      _sourceChannels = <String>{};
      _paymentMethod = null;
      _selectedProducts = [];
      _showProductPicker = false;
    });
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final payloadProducts = _selectedProducts.map((p) => CustomerSalesProductItem(
            id: p.id,
            productModelId: p.productModelId,
            productVariantId: p.productVariantId,
            modelName: p.modelName,
            seriesName: p.seriesName,
            category: p.category,
            ram: p.ram,
            rom: p.rom,
            color: p.color,
            quantity: p.quantity,
            status: _status,
          )).toList();

      final detail = await widget.repository.updateCustomerSalesInfo(
        widget.conversationId,
        status: _status,
        interestLevel: _status == 'INTERESTED' ? _interestLevel : null,
        purchaseChannel: _status == 'PURCHASED' ? _sourceChannels.toList() : [],
        paymentMethod: _status == 'PURCHASED' ? _paymentMethod : null,
        products: payloadProducts,
      );
      if (!mounted) return;
      Navigator.of(context).pop(detail);
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
    final l10n = appLocalizations(context);

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
                  // Top Header Actions
                  Row(
                    children: [
                      IconButton(
                        onPressed: _saving ? null : () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                        tooltip: l10n.close,
                        visualDensity: VisualDensity.compact,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(
                          l10n.customerSalesInformation,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      TextButton(
                        onPressed: _saving ? null : _clearAll,
                        child: Text(l10n.clearAll),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      FilledButton(
                        onPressed: _saving ? null : _save,
                        child: _saving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(l10n.save),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // 1. Mandatory Customer Status Segment Control
                  Text(l10n.customerStatus,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: AppSpacing.xs),
                  SizedBox(
                    width: double.infinity,
                    child: SegmentedButton<String>(
                      segments: [
                        ButtonSegment(
                          value: 'INTERESTED',
                          label: Text(l10n.statusInterested),
                          icon: const Icon(Icons.flag_outlined),
                        ),
                        ButtonSegment(
                          value: 'PURCHASED',
                          label: Text(l10n.statusPurchased),
                          icon: const Icon(Icons.shopping_bag_outlined),
                        ),
                      ],
                      selected: {_status},
                      onSelectionChanged: _saving
                          ? null
                          : (selection) {
                              setState(() {
                                _status = selection.first;
                                if (_status == 'INTERESTED' && _interestLevel == null) {
                                  _interestLevel = 'HOT';
                                }
                              });
                            },
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // 2. Conditional Fields: If INTERESTED -> Interest Level
                  if (_status == 'INTERESTED') ...[
                    Text(l10n.interestLevel,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      children: [
                        ChoiceChip(
                          label: Text('🔥 ${l10n.interestHot}'),
                          selected: _interestLevel == 'HOT',
                          onSelected: _saving ? null : (_) => setState(() => _interestLevel = 'HOT'),
                        ),
                        ChoiceChip(
                          label: Text('⚡ ${l10n.interestWarm}'),
                          selected: _interestLevel == 'WARM',
                          onSelected: _saving ? null : (_) => setState(() => _interestLevel = 'WARM'),
                        ),
                        ChoiceChip(
                          label: Text('❄️ ${l10n.interestCold}'),
                          selected: _interestLevel == 'COLD',
                          onSelected: _saving ? null : (_) => setState(() => _interestLevel = 'COLD'),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  // 3. Conditional Fields: If PURCHASED -> Channel & Payment Method
                  if (_status == 'PURCHASED') ...[
                    Text(l10n.purchaseChannel,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      children: [
                        FilterChip(
                          label: Text('🏪 ${l10n.store}'),
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
                          label: Text('🌐 ${l10n.online}'),
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
                    const SizedBox(height: AppSpacing.md),

                    Text(l10n.paymentMethod,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      children: [
                        ChoiceChip(
                          label: Text('💵 ${l10n.paymentCash}'),
                          selected: _paymentMethod == 'CASH',
                          onSelected: _saving ? null : (selected) => setState(() => _paymentMethod = selected ? 'CASH' : null),
                        ),
                        ChoiceChip(
                          label: Text('💳 ${l10n.installment}'),
                          selected: _paymentMethod == 'INSTALLMENT',
                          onSelected: _saving ? null : (selected) => setState(() => _paymentMethod = selected ? 'INSTALLMENT' : null),
                        ),
                        ChoiceChip(
                          label: Text('💳 ${l10n.paymentCreditCard}'),
                          selected: _paymentMethod == 'CREDIT_CARD',
                          onSelected: _saving ? null : (selected) => setState(() => _paymentMethod = selected ? 'CREDIT_CARD' : null),
                        ),
                        ChoiceChip(
                          label: Text('🏷️ ${l10n.paymentOther}'),
                          selected: _paymentMethod == 'OTHER',
                          onSelected: _saving ? null : (selected) => setState(() => _paymentMethod = selected ? 'OTHER' : null),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  // 4. Products List (Multi-Product)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _status == 'PURCHASED' ? l10n.productsPurchased : l10n.productsInterested,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      if (!_showProductPicker)
                        OutlinedButton.icon(
                          onPressed: _saving ? null : _openAddProduct,
                          icon: const Icon(Icons.add, size: 16),
                          label: Text(l10n.addProduct),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),

                  if (_selectedProducts.isEmpty && !_showProductPicker)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                      child: Text(
                        l10n.noCustomerSalesInfo,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).hintColor),
                      ),
                    ),

                  // Multi-Product Selected Cards
                  ..._selectedProducts.asMap().entries.map((entry) {
                    final index = entry.key;
                    final product = entry.value;
                    final variantText = product.variantLabel;

                    return Card(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            const Icon(Icons.check_circle_outline, color: Colors.green, size: 20),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    product.modelName,
                                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                  if (product.seriesName != null || product.category != null)
                                    Text(
                                      [product.seriesName, product.category].whereType<String>().join(' · '),
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                                    ),
                                  if (variantText.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        variantText,
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            // Quantity Controls
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline, size: 20),
                                  onPressed: _saving ? null : () => _updateQuantity(index, -1),
                                  visualDensity: VisualDensity.compact,
                                ),
                                Text(
                                  '${product.quantity}',
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_outline, size: 20),
                                  onPressed: _saving ? null : () => _updateQuantity(index, 1),
                                  visualDensity: VisualDensity.compact,
                                ),
                              ],
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                              onPressed: _saving ? null : () => _removeProduct(index),
                              visualDensity: VisualDensity.compact,
                            ),
                          ],
                        ),
                      ),
                    );
                  }),

                  // Inline Product Picker Box when adding
                  if (_showProductPicker) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Card(
                      elevation: 3,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: Theme.of(context).colorScheme.primary.withAlpha(100)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(l10n.addProduct, style: Theme.of(context).textTheme.titleMedium),
                                IconButton(
                                  icon: const Icon(Icons.close, size: 20),
                                  onPressed: () => setState(() => _showProductPicker = false),
                                ),
                              ],
                            ),
                            if (_addingProduct == null) ...[
                              TextField(
                                controller: _searchController,
                                onChanged: _loadProducts,
                                decoration: InputDecoration(
                                  prefixIcon: const Icon(Icons.search),
                                  hintText: l10n.searchProduct,
                                  isDense: true,
                                  border: const OutlineInputBorder(),
                                ),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              if (_loadingProducts)
                                const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
                              else if (_catalogProducts.isEmpty)
                                Center(child: Padding(padding: const EdgeInsets.all(16), child: Text(l10n.noMatchingProducts)))
                              else
                                ConstrainedBox(
                                  constraints: const BoxConstraints(maxHeight: 180),
                                  child: ListView.builder(
                                    shrinkWrap: true,
                                    itemCount: _catalogProducts.length,
                                    itemBuilder: (context, idx) {
                                      final p = _catalogProducts[idx];
                                      return ListTile(
                                        dense: true,
                                        title: Text(p.productName, style: const TextStyle(fontWeight: FontWeight.w600)),
                                        subtitle: Text(p.seriesName),
                                        onTap: () => _selectProduct(p),
                                      );
                                    },
                                  ),
                                ),
                            ] else ...[
                              // Selected Product preview
                              Row(
                                children: [
                                  const Icon(Icons.phone_android, color: Colors.blueAccent),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(_addingProduct!.productName, style: Theme.of(context).textTheme.titleSmall),
                                        Text(_addingProduct!.seriesName, style: Theme.of(context).textTheme.bodySmall),
                                      ],
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () => setState(() => _addingProduct = null),
                                    child: Text(l10n.change),
                                  ),
                                ],
                              ),
                              const Divider(),
                              if (_loadingVariants)
                                const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()))
                              else if (_variantError != null)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 4),
                                  child: Text(_variantError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                                )
                              else if (_catalogVariants.isNotEmpty) ...[
                                Text(l10n.configuration, style: Theme.of(context).textTheme.labelLarge),
                                const SizedBox(height: 4),
                                Wrap(
                                  spacing: AppSpacing.xs,
                                  runSpacing: AppSpacing.xs,
                                  children: _catalogVariants.map((v) {
                                    final labelParts = [
                                      if (v.ram?.isNotEmpty == true) '${v.ram}GB',
                                      if (v.rom?.isNotEmpty == true) '${v.rom}GB',
                                      if (v.color?.isNotEmpty == true) v.color!,
                                    ];
                                    final isSelected = _addingVariant?.id == v.id;
                                    return ChoiceChip(
                                      label: Text(labelParts.join(' · ')),
                                      selected: isSelected,
                                      onSelected: (selected) => setState(() => _addingVariant = selected ? v : null),
                                    );
                                  }).toList(),
                                ),
                              ],
                              const SizedBox(height: AppSpacing.sm),
                              // Quantity selection for adding item
                              Row(
                                children: [
                                  Text('${l10n.quantity}:', style: Theme.of(context).textTheme.labelLarge),
                                  const SizedBox(width: 12),
                                  IconButton(
                                    icon: const Icon(Icons.remove_circle_outline, size: 20),
                                    onPressed: _addingQuantity > 1 ? () => setState(() => _addingQuantity--) : null,
                                  ),
                                  Text('$_addingQuantity', style: const TextStyle(fontWeight: FontWeight.bold)),
                                  IconButton(
                                    icon: const Icon(Icons.add_circle_outline, size: 20),
                                    onPressed: () => setState(() => _addingQuantity++),
                                  ),
                                  const Spacer(),
                                  FilledButton(
                                    onPressed: _confirmAddProduct,
                                    child: Text(l10n.save),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],

                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.sm),
                      child: Text(_error!,
                          style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
