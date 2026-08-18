import 'package:flutter/material.dart';

import '../../../core/models/models.dart';
import '../../../core/localization/localization.dart';
import '../../../core/theme/app_spacing.dart';
import '../../inbox/conversation_repository.dart';

String _getCategoryIcon(String? category, [String? modelName]) {
  final cat = (category ?? '').toUpperCase();
  final model = (modelName ?? '').toUpperCase();
  if (cat.contains('AUDIO') || cat.contains('EARPHONE') || cat.contains('ENCO') || cat.contains('HEADPHONE')) return '🎧';
  if (cat.contains('PAD') || cat.contains('TABLET') || cat.contains('PC')) return '💻';
  if (cat.contains('WATCH') || cat.contains('WEARABLE')) return '⌚';
  if (cat.contains('PHONE') || cat.contains('SMARTPHONE') || model.contains('FIND') || model.contains('RENO') || model.contains('OPPO') || cat.isEmpty) return '📱';
  return '📦';
}

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
      child: GestureDetector(
        onTap: onPressed,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest.withAlpha(70),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: Theme.of(context).dividerColor.withAlpha(50),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(
                  sales?.isPurchased == true
                      ? Icons.shopping_bag_outlined
                      : Icons.flag_outlined,
                  size: 18,
                  color: sales?.isPurchased == true ? Colors.green : Colors.blue,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isLegacy)
                      Text(
                        appLocalizations(context).noPurchaseInformation,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                    if (hasSalesData) ...[
                      // Status & Interest Level badges
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: sales.isPurchased
                                  ? Colors.green.withAlpha(35)
                                  : Colors.blue.withAlpha(35),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              sales.isPurchased
                                  ? '🛍️ ${appLocalizations(context).statusPurchased}'
                                  : '🎯 ${appLocalizations(context).statusInterested}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: sales.isPurchased ? Colors.green.shade800 : Colors.blue.shade800,
                              ),
                            ),
                          ),
                          if (sales.isInterested && sales.interestLevel != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                switch (sales.interestLevel) {
                                  'HOT' => '🔥 ${appLocalizations(context).interestHot}',
                                  'WARM' => '⚡ ${appLocalizations(context).interestWarm}',
                                  'COLD' => '❄️ ${appLocalizations(context).interestCold}',
                                  _ => sales.interestLevel!,
                                },
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ),
                          if (sales.isPurchased) ...[
                            ...sales.purchaseChannel.map((src) => Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    src == 'STORE'
                                        ? '🏪 ${appLocalizations(context).store}'
                                        : '🌐 ${appLocalizations(context).online}',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                                  ),
                                )),
                            if (sales.paymentMethod != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  switch (sales.paymentMethod) {
                                    'INSTALLMENT' => '💳 ${appLocalizations(context).installment}',
                                    'CASH' => '💵 ${appLocalizations(context).paymentCash}',
                                    'CREDIT_CARD' => '💳 ${appLocalizations(context).paymentCreditCard}',
                                    'OTHER' => '🏷️ ${appLocalizations(context).paymentOther}',
                                    _ => sales.paymentMethod!,
                                  },
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                                ),
                              ),
                          ],
                        ],
                      ),
                      // Products summary
                      if (sales.products.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        ...sales.products.map((p) {
                          final icon = _getCategoryIcon(p.category, p.modelName);
                          final qty = p.quantity > 1 ? ' (x${p.quantity})' : '';
                          final variant = p.variantLabel;
                          return Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              '$icon ${p.modelName}$qty${variant.isNotEmpty ? ' · $variant' : ''}',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                        }),
                      ],
                    ] else if (!current.isEmpty)
                      Text(
                        _legacyTagsLabel(context, current),
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                    if (hasProvenance) ...[
                      const SizedBox(height: 3),
                      Text(
                        _provenanceLabel(context, sales, purchaseInformation),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).hintColor,
                              fontSize: 10.5,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              const Icon(Icons.edit_outlined, size: 16),
            ],
          ),
        ),
      ),
    );
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
  String? _interestLevel; // Nullable neutral state (no default 'HOT')
  late Set<String> _sourceChannels;
  late String? _paymentMethod;
  // Existing CRM products list (persisted in CRM)
  late List<CustomerSalesProductItem> _selectedProducts;

  final _searchController = TextEditingController();
  List<ProductSelectorItem> _catalogProducts = const [];
  List<ProductVariantSelectorItem> _catalogVariants = const [];

  // Isolated Temporary Draft State for Product Picker (does not modify _selectedProducts until confirmed)
  ProductSelectorItem? _draftProduct;
  ProductVariantSelectorItem? _draftVariant;
  int _draftQuantity = 1;

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
      _interestLevel = sales.interestLevel; // Neutral state if null
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
        _interestLevel = null; // No default selection
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
        if (_draftVariant != null &&
            !_catalogVariants.any((candidate) => candidate.id == _draftVariant!.id)) {
          _draftVariant = null;
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
      _draftProduct = null;
      _draftVariant = null;
      _draftQuantity = 1;
      _catalogVariants = const [];
      _variantError = null;
      _searchController.clear();
    });
    _loadProducts();
  }

  void _cancelAddProduct() {
    setState(() {
      _showProductPicker = false;
      _draftProduct = null;
      _draftVariant = null;
      _draftQuantity = 1;
      _catalogVariants = const [];
      _variantError = null;
      _searchController.clear();
    });
  }

  void _selectDraftProduct(ProductSelectorItem product) {
    setState(() {
      _draftProduct = product;
      _draftVariant = null;
      _draftQuantity = 1;
      _catalogVariants = const [];
      _variantError = null;
    });
    _loadVariants(product.id);
  }

  void _changeDraftProduct() {
    setState(() {
      _draftProduct = null;
      _draftVariant = null;
      _draftQuantity = 1;
      _catalogVariants = const [];
      _variantError = null;
    });
  }

  void _selectDraftVariant(ProductVariantSelectorItem? variant) {
    setState(() {
      _draftVariant = variant;
    });
  }

  void _updateDraftQuantity(int delta) {
    setState(() {
      final next = _draftQuantity + delta;
      if (next >= 1) {
        _draftQuantity = next;
      }
    });
  }

  bool get _canConfirmSelection {
    if (_draftProduct == null) return false;
    if (_loadingVariants) return false;
    // If product has variants available, a variant must be selected
    if (_catalogVariants.isNotEmpty && _draftVariant == null) return false;
    return true;
  }

  void _confirmDraftSelection() {
    if (!_canConfirmSelection || _draftProduct == null) return;
    final item = CustomerSalesProductItem(
      id: '',
      productModelId: _draftProduct!.id,
      productVariantId: _draftVariant?.id,
      modelName: _draftProduct!.productName,
      seriesName: _draftProduct!.seriesName,
      category: _draftProduct!.category,
      ram: _draftVariant?.ram,
      rom: _draftVariant?.rom,
      color: _draftVariant?.color,
      quantity: _draftQuantity,
      status: _status,
    );

    setState(() {
      _selectedProducts.add(item);
      _showProductPicker = false;
      _draftProduct = null;
      _draftVariant = null;
      _draftQuantity = 1;
      _catalogVariants = const [];
      _variantError = null;
      _searchController.clear();
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
      _interestLevel = null;
      _sourceChannels = <String>{};
      _paymentMethod = null;
      _selectedProducts = [];
      _showProductPicker = false;
    });
  }

  Future<void> _promptSaveConfirmation() async {
    final l10n = appLocalizations(context);
    final isConverting = widget.initialSalesInfo?.isInterested == true && _status == 'PURCHASED';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Row(
          children: [
            Icon(
              isConverting ? Icons.shopping_bag_outlined : Icons.fact_check_outlined,
              color: isConverting ? Colors.green : Colors.blueAccent,
              size: 22,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                isConverting ? l10n.confirmPurchase : l10n.confirmCustomerInfo,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isConverting) ...[
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.withAlpha(25),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      const Text('🎯 Interested', style: TextStyle(fontSize: 11, color: Colors.blue, fontWeight: FontWeight.bold)),
                      const Text(' → ', style: TextStyle(fontWeight: FontWeight.bold)),
                      const Text('🛍️ Purchased', style: TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ],

              // Customer Status
              Text(l10n.customerStatus, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor, fontWeight: FontWeight.bold)),
              const SizedBox(height: 2),
              Text(
                _status == 'PURCHASED' ? '🛍️ ${l10n.statusPurchased}' : '🎯 ${l10n.statusInterested}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),

              // Interest Level (if Interested)
              if (_status == 'INTERESTED') ...[
                Text(l10n.interestLevel, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor, fontWeight: FontWeight.bold)),
                const SizedBox(height: 2),
                Text(
                  _interestLevel == 'HOT'
                      ? '🔥 ${l10n.interestHot}'
                      : _interestLevel == 'WARM'
                          ? '⚡ ${l10n.interestWarm}'
                          : _interestLevel == 'COLD'
                              ? '❄️ ${l10n.interestCold}'
                              : l10n.interestNotSpecified,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 12),
              ],

              // Purchase Channel & Payment (if Purchased)
              if (_status == 'PURCHASED') ...[
                if (_sourceChannels.isNotEmpty) ...[
                  Text(l10n.purchaseChannel, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(
                    _sourceChannels.map((s) => s == 'STORE' ? '🏪 ${l10n.store}' : '🌐 ${l10n.online}').join(', '),
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 12),
                ],
                if (_paymentMethod != null) ...[
                  Text(l10n.paymentMethod, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(
                    switch (_paymentMethod) {
                      'CASH' => '💵 ${l10n.paymentCash}',
                      'INSTALLMENT' => '💳 ${l10n.installment}',
                      'CREDIT_CARD' => '💳 ${l10n.paymentCreditCard}',
                      'OTHER' => '🏷️ ${l10n.paymentOther}',
                      _ => _paymentMethod!,
                    },
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 12),
                ],
              ],

              // Products
              Text(
                _status == 'PURCHASED' ? l10n.productsPurchased : l10n.productsInterested,
                style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              if (_selectedProducts.isEmpty)
                Text(l10n.noCustomerSalesInfo, style: TextStyle(fontStyle: FontStyle.italic, color: Theme.of(context).hintColor, fontSize: 13))
              else
                ..._selectedProducts.asMap().entries.map((e) {
                  final idx = e.key + 1;
                  final p = e.value;
                  final icon = _getCategoryIcon(p.category, p.modelName);
                  final variantText = p.variantLabel;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('$idx. ', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$icon ${p.modelName}${p.quantity > 1 ? ' (x${p.quantity})' : ''}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                              ),
                              if (variantText.isNotEmpty)
                                Text(
                                  variantText,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(false),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            style: isConverting ? FilledButton.styleFrom(backgroundColor: Colors.green.shade700) : null,
            onPressed: () => Navigator.of(dialogCtx).pop(true),
            child: Text(isConverting ? l10n.confirmPurchase : l10n.confirmSave),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _save();
    }
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
    final isExistingInterested = widget.initialSalesInfo?.isInterested == true;

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
                        onPressed: _saving ? null : _promptSaveConfirmation,
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

                  // Conversion Banner (if already Interested lead and currently in Interested view)
                  if (isExistingInterested && _status == 'INTERESTED') ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: AppSpacing.md),
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: Colors.green.withAlpha(20),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.green.withAlpha(80)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.shopping_bag_outlined, color: Colors.green, size: 22),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  l10n.convertToPurchased,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.green),
                                ),
                                Text(
                                  _selectedProducts.isNotEmpty
                                      ? '${_selectedProducts.length} ${l10n.product} (${_selectedProducts.map((p) => p.modelName).join(', ')})'
                                      : l10n.statusPurchased,
                                  style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          FilledButton.icon(
                            style: FilledButton.styleFrom(
                              backgroundColor: Colors.green.shade700,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              visualDensity: VisualDensity.compact,
                            ),
                            onPressed: () {
                              setState(() {
                                _status = 'PURCHASED';
                                _selectedProducts = _selectedProducts
                                    .map((p) => CustomerSalesProductItem(
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
                                          status: 'PURCHASED',
                                        ))
                                    .toList();
                              });
                            },
                            icon: const Icon(Icons.arrow_forward, size: 14),
                            label: Text(l10n.convertToPurchased, style: const TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    ),
                  ],

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
                              });
                            },
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // 2. Conditional Fields: If INTERESTED -> Interest Level (with neutral state)
                  if (_status == 'INTERESTED') ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(l10n.interestLevel,
                            style: Theme.of(context).textTheme.titleMedium),
                        if (_interestLevel == null)
                          Text(
                            '(${l10n.interestNotSpecified})',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).hintColor,
                                  fontStyle: FontStyle.italic,
                                ),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      children: [
                        ChoiceChip(
                          showCheckmark: false,
                          label: Text(_interestLevel == 'HOT' ? '✓ 🔥 ${l10n.interestHot}' : '○ 🔥 ${l10n.interestHot}'),
                          selected: _interestLevel == 'HOT',
                          onSelected: _saving ? null : (selected) => setState(() => _interestLevel = selected ? 'HOT' : null),
                        ),
                        ChoiceChip(
                          showCheckmark: false,
                          label: Text(_interestLevel == 'WARM' ? '✓ ⚡ ${l10n.interestWarm}' : '○ ⚡ ${l10n.interestWarm}'),
                          selected: _interestLevel == 'WARM',
                          onSelected: _saving ? null : (selected) => setState(() => _interestLevel = selected ? 'WARM' : null),
                        ),
                        ChoiceChip(
                          showCheckmark: false,
                          label: Text(_interestLevel == 'COLD' ? '✓ ❄️ ${l10n.interestCold}' : '○ ❄️ ${l10n.interestCold}'),
                          selected: _interestLevel == 'COLD',
                          onSelected: _saving ? null : (selected) => setState(() => _interestLevel = selected ? 'COLD' : null),
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
                          showCheckmark: false,
                          label: Text(_sourceChannels.contains('STORE') ? '✓ 🏪 ${l10n.store}' : '○ 🏪 ${l10n.store}'),
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
                          showCheckmark: false,
                          label: Text(_sourceChannels.contains('ONLINE') ? '✓ 🌐 ${l10n.online}' : '○ 🌐 ${l10n.online}'),
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
                          showCheckmark: false,
                          label: Text(_paymentMethod == 'CASH' ? '✓ 💵 ${l10n.paymentCash}' : '○ 💵 ${l10n.paymentCash}'),
                          selected: _paymentMethod == 'CASH',
                          onSelected: _saving ? null : (selected) => setState(() => _paymentMethod = selected ? 'CASH' : null),
                        ),
                        ChoiceChip(
                          showCheckmark: false,
                          label: Text(_paymentMethod == 'INSTALLMENT' ? '✓ 💳 ${l10n.installment}' : '○ 💳 ${l10n.installment}'),
                          selected: _paymentMethod == 'INSTALLMENT',
                          onSelected: _saving ? null : (selected) => setState(() => _paymentMethod = selected ? 'INSTALLMENT' : null),
                        ),
                        ChoiceChip(
                          showCheckmark: false,
                          label: Text(_paymentMethod == 'CREDIT_CARD' ? '✓ 💳 ${l10n.paymentCreditCard}' : '○ 💳 ${l10n.paymentCreditCard}'),
                          selected: _paymentMethod == 'CREDIT_CARD',
                          onSelected: _saving ? null : (selected) => setState(() => _paymentMethod = selected ? 'CREDIT_CARD' : null),
                        ),
                        ChoiceChip(
                          showCheckmark: false,
                          label: Text(_paymentMethod == 'OTHER' ? '✓ 🏷️ ${l10n.paymentOther}' : '○ 🏷️ ${l10n.paymentOther}'),
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
                    final icon = _getCategoryIcon(product.category, product.modelName);

                    return Card(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(
                          color: Theme.of(context).dividerColor.withAlpha(80),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text(icon, style: const TextStyle(fontSize: 22)),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    product.modelName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                  if ((product.seriesName?.isNotEmpty ?? false) || (product.category?.isNotEmpty ?? false))
                                    Text(
                                      [product.seriesName, product.category].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                                    ),
                                  if (variantText.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                        decoration: BoxDecoration(
                                          color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          variantText,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            // Quantity Stepper
                            Container(
                              decoration: BoxDecoration(
                                border: Border.all(color: Theme.of(context).dividerColor.withAlpha(100)),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.remove, size: 16),
                                    onPressed: _saving ? null : () => _updateQuantity(index, -1),
                                    visualDensity: VisualDensity.compact,
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                  ),
                                  Text(
                                    '${product.quantity}',
                                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.add, size: 16),
                                    onPressed: _saving ? null : () => _updateQuantity(index, 1),
                                    visualDensity: VisualDensity.compact,
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                  ),
                                ],
                              ),
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
                        side: BorderSide(color: Theme.of(context).colorScheme.primary.withAlpha(120), width: 1.5),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(l10n.addProduct, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                                IconButton(
                                  icon: const Icon(Icons.close, size: 20),
                                  onPressed: _cancelAddProduct,
                                ),
                              ],
                            ),
                            if (_draftProduct == null) ...[
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
                                  constraints: const BoxConstraints(maxHeight: 220),
                                  child: ListView.separated(
                                    shrinkWrap: true,
                                    itemCount: _catalogProducts.length,
                                    separatorBuilder: (_, __) => const Divider(height: 1),
                                    itemBuilder: (context, idx) {
                                      final p = _catalogProducts[idx];
                                      return ListTile(
                                        dense: true,
                                        leading: Text(
                                          _getCategoryIcon(p.category, p.productName),
                                          style: const TextStyle(fontSize: 20),
                                        ),
                                        title: Text(
                                          '○ ${p.productName}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontWeight: FontWeight.w600),
                                        ),
                                        subtitle: Text(
                                          [p.seriesName, p.category].where((s) => s.isNotEmpty).join(' · '),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        trailing: OutlinedButton(
                                          style: OutlinedButton.styleFrom(
                                            visualDensity: VisualDensity.compact,
                                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                          ),
                                          onPressed: () => _selectDraftProduct(p),
                                          child: Text(l10n.select),
                                        ),
                                        onTap: () => _selectDraftProduct(p),
                                      );
                                    },
                                  ),
                                ),
                            ] else ...[
                              // Selected Draft Product visual confirmation container
                              Container(
                                padding: const EdgeInsets.all(AppSpacing.sm),
                                decoration: BoxDecoration(
                                  color: Colors.green.withAlpha(15),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.green.withAlpha(90), width: 1.2),
                                ),
                                child: Row(
                                  children: [
                                    Text(
                                      _getCategoryIcon(_draftProduct!.category, _draftProduct!.productName),
                                      style: const TextStyle(fontSize: 24),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  _draftProduct!.productName,
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                                                ),
                                              ),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: Colors.green.withAlpha(30),
                                                  borderRadius: BorderRadius.circular(6),
                                                  border: Border.all(color: Colors.green.withAlpha(120)),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    const Icon(Icons.check_circle, size: 12, color: Colors.green),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      l10n.selected,
                                                      style: const TextStyle(
                                                        color: Colors.green,
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 2),
                                          if (_draftProduct!.seriesName.isNotEmpty || _draftProduct!.category.isNotEmpty)
                                            Text(
                                              [_draftProduct!.seriesName, _draftProduct!.category].where((s) => s.isNotEmpty).join(' · '),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: Theme.of(context).textTheme.bodySmall,
                                            ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    OutlinedButton.icon(
                                      style: OutlinedButton.styleFrom(
                                        visualDensity: VisualDensity.compact,
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      ),
                                      onPressed: _changeDraftProduct,
                                      icon: const Icon(Icons.swap_horiz, size: 16),
                                      label: Text(l10n.changeProduct),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              if (_loadingVariants)
                                const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()))
                              else if (_variantError != null)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 4),
                                  child: Text(_variantError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                                )
                              else if (_catalogVariants.isNotEmpty) ...[
                                Text(l10n.configuration, style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.bold)),
                                const SizedBox(height: 6),
                                Wrap(
                                  spacing: AppSpacing.xs,
                                  runSpacing: AppSpacing.xs,
                                  children: _catalogVariants.map((v) {
                                    final labelParts = [
                                      if (v.ram?.isNotEmpty == true) '${v.ram}GB RAM',
                                      if (v.rom?.isNotEmpty == true) '${v.rom}GB ROM',
                                      if (v.color?.isNotEmpty == true) v.color!,
                                    ];
                                    final isSelected = _draftVariant?.id == v.id;
                                    final prefix = isSelected ? '✓ ' : '○ ';
                                    return ChoiceChip(
                                      showCheckmark: false,
                                      label: Text('$prefix${labelParts.join(' · ')}'),
                                      selected: isSelected,
                                      selectedColor: Theme.of(context).colorScheme.primary.withAlpha(35),
                                      side: BorderSide(
                                        color: isSelected
                                            ? Theme.of(context).colorScheme.primary
                                            : Theme.of(context).dividerColor,
                                        width: isSelected ? 1.5 : 1,
                                      ),
                                      onSelected: (selected) => _selectDraftVariant(selected ? v : null),
                                    );
                                  }).toList(),
                                ),
                              ],
                              const SizedBox(height: AppSpacing.md),
                              // Quantity selection for draft item
                              Row(
                                children: [
                                  Text('${l10n.quantity}:', style: Theme.of(context).textTheme.labelLarge),
                                  const SizedBox(width: 8),
                                  Container(
                                    decoration: BoxDecoration(
                                      border: Border.all(color: Theme.of(context).dividerColor),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        IconButton(
                                          icon: const Icon(Icons.remove, size: 16),
                                          onPressed: _draftQuantity > 1 ? () => _updateDraftQuantity(-1) : null,
                                          visualDensity: VisualDensity.compact,
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 6),
                                          child: Text('$_draftQuantity', style: const TextStyle(fontWeight: FontWeight.bold)),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.add, size: 16),
                                          onPressed: () => _updateDraftQuantity(1),
                                          visualDensity: VisualDensity.compact,
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.md),
                              // Confirm Selection Full-Width CTA Button
                              SizedBox(
                                width: double.infinity,
                                child: FilledButton.icon(
                                  style: FilledButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  ),
                                  onPressed: _canConfirmSelection ? _confirmDraftSelection : null,
                                  icon: const Icon(Icons.check_circle_outline, size: 18),
                                  label: Text(
                                    l10n.confirmSelection,
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                ),
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
