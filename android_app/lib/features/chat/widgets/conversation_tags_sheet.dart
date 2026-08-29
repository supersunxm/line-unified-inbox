import 'package:flutter/material.dart';

import '../../../core/localization/localization.dart';
import '../../../core/models/models.dart';
import '../../../core/theme/app_spacing.dart';
import '../../inbox/conversation_repository.dart';

String _getCategoryIcon(String? category, [String? modelName]) {
  final cat = (category ?? '').toUpperCase();
  final model = (modelName ?? '').toUpperCase();
  if (cat.contains('AUDIO') ||
      cat.contains('EARPHONE') ||
      cat.contains('ENCO') ||
      cat.contains('HEADPHONE')) {
    return '🎧';
  }
  if (cat.contains('PAD') || cat.contains('TABLET') || cat.contains('PC')) {
    return '💻';
  }
  if (cat.contains('WATCH') || cat.contains('WEARABLE')) return '⌚';
  if (cat.contains('PHONE') ||
      cat.contains('SMARTPHONE') ||
      model.contains('FIND') ||
      model.contains('RENO') ||
      model.contains('OPPO') ||
      cat.isEmpty) {
    return '📱';
  }
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
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final sales = customerSalesInformation;
    final current = tags ?? const ConversationTags();
    final hasSalesData = sales != null &&
        (sales.status != null ||
            sales.interestLevel != null ||
            sales.purchaseChannel.isNotEmpty ||
            sales.paymentMethod != null ||
            sales.products.isNotEmpty);
    final hasProvenance = hasSalesData &&
        (sales.recordedBy?.trim().isNotEmpty == true ||
            sales.recordedAt != null ||
            purchaseInformation?.recordedBy?.trim().isNotEmpty == true ||
            purchaseInformation?.recordedAt != null);
    final isLegacy =
        !hasSalesData && purchaseInformation?.recordState == 'LEGACY_MANUAL';

    if (!hasSalesData && current.isEmpty && !isLegacy) {
      return Align(
        alignment: Alignment.centerRight,
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
            color: Theme.of(context)
                .colorScheme
                .surfaceContainerHighest
                .withAlpha(70),
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
                      : sales?.isOnline == true
                          ? Icons.language_outlined
                          : Icons.flag_outlined,
                  size: 18,
                  color:
                      sales?.isPurchased == true ? Colors.green : Colors.blue,
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
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (sales.status != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: sales.isPurchased
                                    ? Colors.green.withAlpha(35)
                                    : Colors.blue.withAlpha(35),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                sales.isPurchased
                                    ? '🛍️ ${appLocalizations(context).statusPurchased}'
                                    : sales.isOnline
                                        ? '🌐 ${appLocalizations(context).statusOnline}'
                                        : '🎯 ${appLocalizations(context).statusInterested}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: sales.isPurchased
                                      ? Colors.green.shade800
                                      : Colors.blue.shade800,
                                ),
                              ),
                            ),
                          if (sales.isInterested && sales.interestLevel != null)
                            _SmallBadge(
                              text: switch (sales.interestLevel) {
                                'HOT' =>
                                  '🔥 ${appLocalizations(context).interestHot}',
                                'WARM' =>
                                  '⚡ ${appLocalizations(context).interestWarm}',
                                'COLD' =>
                                  '❄️ ${appLocalizations(context).interestCold}',
                                _ => sales.interestLevel!,
                              },
                            ),
                          if (sales.isPurchased) ...[
                            ...sales.purchaseChannel.map(
                              (source) => _SmallBadge(
                                text: source == 'STORE'
                                    ? '🏪 ${appLocalizations(context).store}'
                                    : '🌐 ${appLocalizations(context).online}',
                              ),
                            ),
                            if (sales.paymentMethod != null)
                              _SmallBadge(
                                text: switch (sales.paymentMethod) {
                                  'INSTALLMENT' =>
                                    '💳 ${appLocalizations(context).installment}',
                                  'CASH' =>
                                    '💵 ${appLocalizations(context).paymentCash}',
                                  'CREDIT_CARD' =>
                                    '💳 ${appLocalizations(context).paymentCreditCard}',
                                  'OTHER' =>
                                    '🏷️ ${appLocalizations(context).paymentOther}',
                                  _ => sales.paymentMethod!,
                                },
                              ),
                          ],
                        ],
                      ),
                      if (sales.products.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        ...sales.products.map((product) {
                          final icon = _getCategoryIcon(
                              product.category, product.modelName);
                          final quantity = product.quantity > 1
                              ? ' (x${product.quantity})'
                              : '';
                          final variant = product.variantLabel;
                          return Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              '$icon ${product.modelName}$quantity${variant.isNotEmpty ? ' · $variant' : ''}',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(fontWeight: FontWeight.w500),
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

  String _provenanceLabel(BuildContext context, CustomerSalesInformation? sales,
      PurchaseInformation? purchase) {
    final parts = <String>[];
    final recordedBy = sales?.recordedBy?.trim().isNotEmpty == true
        ? sales!.recordedBy!.trim()
        : purchase?.recordedBy?.trim();
    final recordedAt = sales?.recordedAt ?? purchase?.recordedAt;
    if (recordedBy?.isNotEmpty == true) {
      parts.add('${appLocalizations(context).recordedBy}: $recordedBy');
    }
    if (recordedAt != null) {
      final date = MaterialLocalizations.of(context)
          .formatMediumDate(recordedAt.toLocal());
      final time = MaterialLocalizations.of(context)
          .formatTimeOfDay(TimeOfDay.fromDateTime(recordedAt.toLocal()));
      parts.add('${appLocalizations(context).recordedAt}: $date $time');
    }
    return parts.join(' · ');
  }
}

class _SmallBadge extends StatelessWidget {
  const _SmallBadge({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          text,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
        ),
      );
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

class _SalesSnapshot {
  const _SalesSnapshot({
    required this.status,
    required this.interestLevel,
    required this.sourceChannels,
    required this.paymentMethod,
    required this.products,
  });

  final String? status;
  final String? interestLevel;
  final Set<String> sourceChannels;
  final String? paymentMethod;
  final List<CustomerSalesProductItem> products;
}

class _ConversationTagsSheetState extends State<ConversationTagsSheet> {
  String? _status;
  String? _interestLevel;
  late Set<String> _sourceChannels;
  String? _paymentMethod;
  late List<CustomerSalesProductItem> _selectedProducts;

  final _searchController = TextEditingController();
  List<ProductSelectorItem> _catalogProducts = const [];
  List<ProductVariantSelectorItem> _catalogVariants = const [];
  ProductSelectorItem? _draftProduct;
  ProductVariantSelectorItem? _draftVariant;
  int _draftQuantity = 1;

  bool _loadingProducts = false;
  bool _loadingVariants = false;
  bool _saving = false;
  bool _dirty = false;
  bool _showProductPicker = false;
  String? _error;
  String? _variantError;
  int _searchGeneration = 0;
  int _variantGeneration = 0;
  ConversationDetail? _lastSavedDetail;

  @override
  void initState() {
    super.initState();
    final sales = widget.initialSalesInfo;
    if (sales != null &&
        (sales.status != null ||
            sales.interestLevel != null ||
            sales.purchaseChannel.isNotEmpty ||
            sales.paymentMethod != null ||
            sales.products.isNotEmpty)) {
      _status = sales.status;
      _interestLevel = sales.interestLevel;
      _sourceChannels = sales.purchaseChannel.toSet();
      _paymentMethod = sales.paymentMethod;
      _selectedProducts = List.from(sales.products);
      return;
    }

    final tags = widget.initialTags;
    if (tags.product != null ||
        tags.isInstallment ||
        tags.sourceChannels.isNotEmpty) {
      _status = 'PURCHASED';
      _sourceChannels = tags.sourceChannels.toSet();
      _paymentMethod = tags.isInstallment ? 'INSTALLMENT' : null;
      _selectedProducts = tags.product == null
          ? []
          : [
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
              ),
            ];
    } else {
      _status = null;
      _sourceChannels = <String>{};
      _paymentMethod = null;
      _selectedProducts = [];
    }
    _interestLevel = null;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  _SalesSnapshot _snapshot() => _SalesSnapshot(
        status: _status,
        interestLevel: _interestLevel,
        sourceChannels: Set<String>.from(_sourceChannels),
        paymentMethod: _paymentMethod,
        products: List<CustomerSalesProductItem>.from(_selectedProducts),
      );

  void _restore(_SalesSnapshot snapshot) {
    _status = snapshot.status;
    _interestLevel = snapshot.interestLevel;
    _sourceChannels = Set<String>.from(snapshot.sourceChannels);
    _paymentMethod = snapshot.paymentMethod;
    _selectedProducts = List<CustomerSalesProductItem>.from(snapshot.products);
  }

  List<CustomerSalesProductItem> _payloadProducts() {
    final effectiveStatus = _status;
    if (effectiveStatus == null) return [];
    return _selectedProducts
        .map((product) => CustomerSalesProductItem(
              id: product.id,
              productModelId: product.productModelId,
              productVariantId: product.productVariantId,
              modelName: product.modelName,
              seriesName: product.seriesName,
              category: product.category,
              ram: product.ram,
              rom: product.rom,
              color: product.color,
              quantity: product.quantity,
              status: effectiveStatus,
            ))
        .toList();
  }

  void _applyServerDetail(ConversationDetail detail) {
    final sales = detail.customerSalesInformation;
    _status = sales?.status;
    _interestLevel = sales?.interestLevel;
    _sourceChannels = sales?.purchaseChannel.toSet() ?? <String>{};
    _paymentMethod = sales?.paymentMethod;
    _selectedProducts = List<CustomerSalesProductItem>.from(
        sales?.products ?? const <CustomerSalesProductItem>[]);
    _lastSavedDetail = detail;
    _dirty = false;
  }

  Future<bool> _persist({
    _SalesSnapshot? rollback,
    bool closeAfter = false,
  }) async {
    if (_saving) return false;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final detail = await widget.repository.updateCustomerSalesInfo(
        widget.conversationId,
        status: _status,
        interestLevel: _status == 'INTERESTED' ? _interestLevel : null,
        purchaseChannel: _status == 'PURCHASED' ? _sourceChannels.toList() : [],
        paymentMethod: _status == 'PURCHASED' ? _paymentMethod : null,
        products: _payloadProducts(),
      );
      if (!mounted) return false;
      setState(() {
        _applyServerDetail(detail);
        _saving = false;
      });
      if (closeAfter && mounted) Navigator.of(context).pop(detail);
      return true;
    } catch (_) {
      if (!mounted) return false;
      setState(() {
        if (rollback != null) _restore(rollback);
        _saving = false;
        _dirty = rollback == null;
        _error = appLocalizations(context).unableToSaveTags;
      });
      return false;
    }
  }

  Future<void> _closeSheet() async {
    if (_saving) return;
    if (_dirty) {
      await _persist(closeAfter: true);
      return;
    }
    if (mounted) Navigator.of(context).pop(_lastSavedDetail);
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
            !_catalogVariants
                .any((candidate) => candidate.id == _draftVariant!.id)) {
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
    setState(() => _draftVariant = variant);
  }

  void _updateDraftQuantity(int delta) {
    setState(() {
      final next = _draftQuantity + delta;
      if (next >= 1) _draftQuantity = next;
    });
  }

  bool get _canConfirmSelection {
    if (_draftProduct == null || _loadingVariants) return false;
    if (_catalogVariants.isNotEmpty && _draftVariant == null) return false;
    return true;
  }

  Future<void> _confirmDraftSelection() async {
    if (!_canConfirmSelection || _draftProduct == null || _saving) return;
    final previous = _snapshot();
    final effectiveStatus = _status ?? 'INTERESTED';
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
      status: effectiveStatus,
    );
    setState(() {
      _status = effectiveStatus;
      _selectedProducts.add(item);
      _dirty = true;
    });
    final saved = await _persist(rollback: previous);
    if (!saved || !mounted) return;
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

  Future<void> _removeProduct(int index) async {
    if (_saving || index < 0 || index >= _selectedProducts.length) return;
    final previous = _snapshot();
    setState(() {
      _selectedProducts.removeAt(index);
      _dirty = true;
    });
    await _persist(rollback: previous);
  }

  Future<void> _updateQuantity(int index, int delta) async {
    if (_saving || index < 0 || index >= _selectedProducts.length) return;
    final current = _selectedProducts[index];
    final nextQuantity = (current.quantity + delta).clamp(1, 99).toInt();
    if (nextQuantity == current.quantity) return;
    final previous = _snapshot();
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
        quantity: nextQuantity,
        status: _status ?? current.status,
      );
      _dirty = true;
    });
    await _persist(rollback: previous);
  }

  void _setInterestLevel(String value, bool selected) {
    setState(() {
      _interestLevel = selected ? value : null;
      _dirty = true;
    });
  }

  void _setSourceChannel(String value, bool selected) {
    setState(() {
      if (selected) {
        _sourceChannels.add(value);
      } else {
        _sourceChannels.remove(value);
      }
      _dirty = true;
    });
  }

  void _setPaymentMethod(String value, bool selected) {
    setState(() {
      _paymentMethod = selected ? value : null;
      _dirty = true;
    });
  }

  void _setStatus(String? status) {
    setState(() {
      _status = status;
      if (status == null) {
        _interestLevel = null;
        _sourceChannels.clear();
        _paymentMethod = null;
        _selectedProducts = [];
        _showProductPicker = false;
      } else if (status == 'INTERESTED') {
        _sourceChannels.clear();
        _paymentMethod = null;
        _selectedProducts = _selectedProducts
            .map((product) => CustomerSalesProductItem(
                  id: product.id,
                  productModelId: product.productModelId,
                  productVariantId: product.productVariantId,
                  modelName: product.modelName,
                  seriesName: product.seriesName,
                  category: product.category,
                  ram: product.ram,
                  rom: product.rom,
                  color: product.color,
                  quantity: product.quantity,
                  status: 'INTERESTED',
                ))
            .toList();
      } else if (status == 'ONLINE') {
        _interestLevel = null;
        _sourceChannels.clear();
        _paymentMethod = null;
        _selectedProducts = _selectedProducts
            .map((product) => CustomerSalesProductItem(
                  id: product.id,
                  productModelId: product.productModelId,
                  productVariantId: product.productVariantId,
                  modelName: product.modelName,
                  seriesName: product.seriesName,
                  category: product.category,
                  ram: product.ram,
                  rom: product.rom,
                  color: product.color,
                  quantity: product.quantity,
                  status: 'ONLINE',
                ))
            .toList();
      } else {
        _interestLevel = null;
        _selectedProducts = _selectedProducts
            .map((product) => CustomerSalesProductItem(
                  id: product.id,
                  productModelId: product.productModelId,
                  productVariantId: product.productVariantId,
                  modelName: product.modelName,
                  seriesName: product.seriesName,
                  category: product.category,
                  ram: product.ram,
                  rom: product.rom,
                  color: product.color,
                  quantity: product.quantity,
                  status: 'PURCHASED',
                ))
            .toList();
      }
      _dirty = true;
    });
  }

  Future<void> _clearAll() async {
    if (_saving) return;
    final previous = _snapshot();
    setState(() {
      _status = null;
      _interestLevel = null;
      _sourceChannels = <String>{};
      _paymentMethod = null;
      _selectedProducts = [];
      _showProductPicker = false;
      _dirty = true;
    });
    await _persist(rollback: previous);
  }

  Future<void> _promptSaveConfirmation() async {
    final l10n = appLocalizations(context);
    final isConverting =
        widget.initialSalesInfo?.isInterested == true && _status == 'PURCHASED';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
            isConverting ? l10n.confirmPurchase : l10n.confirmCustomerInfo),
        content: Text(
          _status == null
              ? l10n.noCustomerSalesInfo
              : _status == 'PURCHASED'
                  ? '🛍️ ${l10n.statusPurchased}'
                  : _status == 'ONLINE'
                      ? '🌐 ${l10n.statusOnline}'
                      : '🎯 ${l10n.statusInterested}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(isConverting ? l10n.confirmPurchase : l10n.confirmSave),
          ),
        ],
      ),
    );
    if (confirmed == true) await _persist(closeAfter: true);
  }

  Future<void> _handleBack(bool didPop, Object? result) async {
    if (didPop || _saving) return;
    if (_dirty) {
      await _persist(closeAfter: true);
    } else if (mounted) {
      Navigator.of(context).pop(_lastSavedDetail);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = appLocalizations(context);
    final isExistingInterested = widget.initialSalesInfo?.isInterested == true;
    final statusSelection = _status == null ? <String>{} : <String>{_status!};

    return PopScope(
      canPop: !_saving && !_dirty,
      onPopInvokedWithResult: _handleBack,
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(context).bottom),
            child: SingleChildScrollView(
              padding: AppSpacing.screen,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final compactHeader = constraints.maxWidth < 520;
                      final closeButton = IconButton(
                        onPressed: _saving ? null : _closeSheet,
                        icon: const Icon(Icons.close),
                        tooltip: l10n.close,
                        visualDensity: VisualDensity.compact,
                      );
                      final title = Text(
                        l10n.customerSalesInformation,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
                      );
                      final clearButton = TextButton(
                        onPressed: _saving ? null : _clearAll,
                        child: Text(l10n.clearAll),
                      );
                      final saveButton = FilledButton(
                        onPressed: _saving ? null : _promptSaveConfirmation,
                        child: _saving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(l10n.save),
                      );

                      if (compactHeader) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                closeButton,
                                const SizedBox(width: AppSpacing.xs),
                                Expanded(child: title),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                clearButton,
                                const SizedBox(width: AppSpacing.xs),
                                saveButton,
                              ],
                            ),
                          ],
                        );
                      }

                      return Row(
                        children: [
                          closeButton,
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(child: title),
                          clearButton,
                          const SizedBox(width: AppSpacing.xs),
                          saveButton,
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
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
                          const Icon(Icons.shopping_bag_outlined,
                              color: Colors.green, size: 22),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              l10n.convertToPurchased,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.green),
                            ),
                          ),
                          FilledButton.icon(
                            style: FilledButton.styleFrom(
                                backgroundColor: Colors.green.shade700),
                            onPressed:
                                _saving ? null : () => _setStatus('PURCHASED'),
                            icon: const Icon(Icons.arrow_forward, size: 14),
                            label: Text(l10n.convertToPurchased),
                          ),
                        ],
                      ),
                    ),
                  ],
                  Text(
                    l10n.customerStatus,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  SizedBox(
                    width: double.infinity,
                    child: SegmentedButton<String>(
                      segments: [
                        ButtonSegment(
                          value: 'ONLINE',
                          label: Text(l10n.statusOnline),
                          icon: const Icon(Icons.language_outlined),
                        ),
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
                      emptySelectionAllowed: true,
                      selected: statusSelection,
                      onSelectionChanged: _saving
                          ? null
                          : (selection) => _setStatus(
                              selection.isEmpty ? null : selection.first),
                    ),
                  ),
                  if (_status == null)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs),
                      child: Text(
                        l10n.interestNotSpecified,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).hintColor,
                              fontStyle: FontStyle.italic,
                            ),
                      ),
                    ),
                  const SizedBox(height: AppSpacing.lg),
                  if (_status == 'INTERESTED') ...[
                    Text(l10n.interestLevel,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      children: [
                        _choice(
                          'HOT',
                          '🔥 ${l10n.interestHot}',
                          _interestLevel == 'HOT',
                          (selected) => _setInterestLevel('HOT', selected),
                        ),
                        _choice(
                          'WARM',
                          '⚡ ${l10n.interestWarm}',
                          _interestLevel == 'WARM',
                          (selected) => _setInterestLevel('WARM', selected),
                        ),
                        _choice(
                          'COLD',
                          '❄️ ${l10n.interestCold}',
                          _interestLevel == 'COLD',
                          (selected) => _setInterestLevel('COLD', selected),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                  if (_status == 'PURCHASED') ...[
                    Text(l10n.purchaseChannel,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      children: [
                        _filter(
                          '🏪 ${l10n.store}',
                          _sourceChannels.contains('STORE'),
                          (selected) => _setSourceChannel('STORE', selected),
                        ),
                        _filter(
                          '🌐 ${l10n.online}',
                          _sourceChannels.contains('ONLINE'),
                          (selected) => _setSourceChannel('ONLINE', selected),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(l10n.paymentMethod,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      children: [
                        _choice(
                          'CASH',
                          '💵 ${l10n.paymentCash}',
                          _paymentMethod == 'CASH',
                          (selected) => _setPaymentMethod('CASH', selected),
                        ),
                        _choice(
                          'INSTALLMENT',
                          '💳 ${l10n.installment}',
                          _paymentMethod == 'INSTALLMENT',
                          (selected) =>
                              _setPaymentMethod('INSTALLMENT', selected),
                        ),
                        _choice(
                          'CREDIT_CARD',
                          '💳 ${l10n.paymentCreditCard}',
                          _paymentMethod == 'CREDIT_CARD',
                          (selected) =>
                              _setPaymentMethod('CREDIT_CARD', selected),
                        ),
                        _choice(
                          'OTHER',
                          '🏷️ ${l10n.paymentOther}',
                          _paymentMethod == 'OTHER',
                          (selected) => _setPaymentMethod('OTHER', selected),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _status == 'PURCHASED'
                            ? l10n.productsPurchased
                            : l10n.productsInterested,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
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
                      padding:
                          const EdgeInsets.symmetric(vertical: AppSpacing.md),
                      child: Text(
                        l10n.noCustomerSalesInfo,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: Theme.of(context).hintColor),
                      ),
                    ),
                  ..._selectedProducts.asMap().entries.map((entry) {
                    final index = entry.key;
                    final product = entry.value;
                    final variantText = product.variantLabel;
                    final icon =
                        _getCategoryIcon(product.category, product.modelName);
                    return Card(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        child: Row(
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
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleSmall
                                        ?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                  if ((product.seriesName?.isNotEmpty ??
                                          false) ||
                                      (product.category?.isNotEmpty ?? false))
                                    Text(
                                      [product.seriesName, product.category]
                                          .whereType<String>()
                                          .where((value) => value.isNotEmpty)
                                          .join(' · '),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  if (variantText.isNotEmpty)
                                    Text(
                                      variantText,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.remove, size: 16),
                              onPressed: _saving
                                  ? null
                                  : () => _updateQuantity(index, -1),
                            ),
                            Text('${product.quantity}'),
                            IconButton(
                              icon: const Icon(Icons.add, size: 16),
                              onPressed: _saving
                                  ? null
                                  : () => _updateQuantity(index, 1),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline,
                                  color: Colors.redAccent, size: 20),
                              onPressed:
                                  _saving ? null : () => _removeProduct(index),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  if (_showProductPicker) _buildProductPicker(context),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.sm),
                      child: Text(
                        _error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  ChoiceChip _choice(String value, String label, bool selected,
          ValueChanged<bool> onSelected) =>
      ChoiceChip(
        showCheckmark: false,
        label: Text('${selected ? '✓' : '○'} $label'),
        selected: selected,
        onSelected: _saving ? null : onSelected,
      );

  FilterChip _filter(
          String label, bool selected, ValueChanged<bool> onSelected) =>
      FilterChip(
        showCheckmark: false,
        label: Text('${selected ? '✓' : '○'} $label'),
        selected: selected,
        onSelected: _saving ? null : onSelected,
      );

  Widget _buildProductPicker(BuildContext context) {
    final l10n = appLocalizations(context);
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Card(
        elevation: 3,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(l10n.addProduct,
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: _saving ? null : _cancelAddProduct,
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
                  const Center(
                      child: Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(),
                  ))
                else if (_catalogProducts.isEmpty)
                  Center(child: Text(l10n.noMatchingProducts))
                else
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 220),
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: _catalogProducts.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final product = _catalogProducts[index];
                        return ListTile(
                          dense: true,
                          leading: Text(_getCategoryIcon(
                              product.category, product.productName)),
                          title: Text(
                            product.productName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            [product.seriesName, product.category]
                                .where((value) => value.isNotEmpty)
                                .join(' · '),
                          ),
                          trailing: const Icon(Icons.chevron_right, size: 20),
                          onTap: _saving
                              ? null
                              : () => _selectDraftProduct(product),
                        );
                      },
                    ),
                  ),
              ] else ...[
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _draftProduct!.productName,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(l10n.selected),
                        ],
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: _saving ? null : _changeDraftProduct,
                      icon: const Icon(Icons.swap_horiz, size: 16),
                      label: Text(l10n.changeProduct),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                if (_loadingVariants)
                  const Center(child: CircularProgressIndicator())
                else if (_variantError != null)
                  Text(
                    _variantError!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  )
                else if (_catalogVariants.isNotEmpty) ...[
                  Text(l10n.configuration),
                  const SizedBox(height: AppSpacing.xs),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: _catalogVariants.map((variant) {
                      final label = [
                        if (variant.ram?.isNotEmpty == true)
                          '${variant.ram}GB RAM',
                        if (variant.rom?.isNotEmpty == true)
                          '${variant.rom}GB ROM',
                        if (variant.color?.isNotEmpty == true) variant.color!,
                      ].join(' · ');
                      final selected = _draftVariant?.id == variant.id;
                      return ChoiceChip(
                        showCheckmark: false,
                        label: Text('${selected ? '✓' : '○'} $label'),
                        selected: selected,
                        onSelected: _saving
                            ? null
                            : (value) =>
                                _selectDraftVariant(value ? variant : null),
                      );
                    }).toList(),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Text('${l10n.quantity}:'),
                    IconButton(
                      icon: const Icon(Icons.remove, size: 16),
                      onPressed: !_saving && _draftQuantity > 1
                          ? () => _updateDraftQuantity(-1)
                          : null,
                    ),
                    Text('$_draftQuantity'),
                    IconButton(
                      icon: const Icon(Icons.add, size: 16),
                      onPressed: _saving ? null : () => _updateDraftQuantity(1),
                    ),
                  ],
                ),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: !_saving && _canConfirmSelection
                        ? _confirmDraftSelection
                        : null,
                    icon: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.check_circle_outline, size: 18),
                    label: Text(l10n.confirmSelection),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
