from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


tags_path = Path("android_app/lib/features/chat/widgets/conversation_tags_sheet.dart")
tags = tags_path.read_text()

tags = replace_once(
    tags,
    "    this.initialSalesInfo,\n    this.initialPurchaseInfo,\n  });",
    "    this.initialSalesInfo,\n    this.initialPurchaseInfo,\n    this.onSaved,\n  });",
    "tags constructor callback",
)
tags = replace_once(
    tags,
    "  final CustomerSalesInformation? initialSalesInfo;\n  final PurchaseInformation? initialPurchaseInfo;\n\n  static Future<ConversationDetail?> show({",
    "  final CustomerSalesInformation? initialSalesInfo;\n  final PurchaseInformation? initialPurchaseInfo;\n  final ValueChanged<ConversationDetail>? onSaved;\n\n  static Future<ConversationDetail?> show({",
    "tags callback field",
)
tags = replace_once(
    tags,
    "    CustomerSalesInformation? initialSalesInfo,\n    PurchaseInformation? initialPurchaseInfo,\n  }) =>",
    "    CustomerSalesInformation? initialSalesInfo,\n    PurchaseInformation? initialPurchaseInfo,\n    ValueChanged<ConversationDetail>? onSaved,\n  }) =>",
    "tags show callback param",
)
tags = replace_once(
    tags,
    "            initialSalesInfo: initialSalesInfo,\n            initialPurchaseInfo: initialPurchaseInfo,\n          ),",
    "            initialSalesInfo: initialSalesInfo,\n            initialPurchaseInfo: initialPurchaseInfo,\n            onSaved: onSaved,\n          ),",
    "tags show callback pass-through",
)

old_icon = """              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(
                  sales?.isPurchased == true
                      ? Icons.shopping_bag_outlined
                      : sales?.isFilm == true
                          ? Icons.shield_outlined
                          : sales?.isOnline == true
                              ? Icons.language_outlined
                              : Icons.flag_outlined,
                  size: 18,
                  color: sales?.isPurchased == true
                      ? Colors.green
                      : sales?.isFilm == true
                          ? Colors.deepPurple
                          : Colors.blue,
                ),
              ),"""
new_icon = """              SizedBox(
                key: const ValueKey('conversation-tags-leading-slot'),
                width: 20,
                child: Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Icon(
                    sales?.isPurchased == true
                        ? Icons.shopping_bag_outlined
                        : sales?.isFilm == true
                            ? Icons.shield_outlined
                            : sales?.isOnline == true
                                ? Icons.language_outlined
                                : Icons.flag_outlined,
                    size: 18,
                    color: sales?.isPurchased == true
                        ? Colors.green
                        : sales?.isFilm == true
                            ? Colors.deepPurple
                            : Colors.blue,
                  ),
                ),
              ),"""
tags = replace_once(tags, old_icon, new_icon, "stable leading icon slot")
tags = replace_once(
    tags,
    "              Expanded(\n                child: Column(\n                  crossAxisAlignment: CrossAxisAlignment.start,\n                  children: [",
    "              Expanded(\n                key: const ValueKey('conversation-tags-content'),\n                child: Column(\n                  crossAxisAlignment: CrossAxisAlignment.stretch,\n                  children: [",
    "tight summary content width",
)
tags = replace_once(
    tags,
    """                            child: Text(
                              '$icon ${product.modelName}$quantity${variant.isNotEmpty ? ' · $variant' : ''}',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(fontWeight: FontWeight.w500),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),""",
    """                            child: Text(
                              '$icon ${product.modelName}$quantity${variant.isNotEmpty ? ' · $variant' : ''}',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(fontWeight: FontWeight.w500),
                              maxLines: 2,
                              softWrap: true,
                              overflow: TextOverflow.ellipsis,
                            ),""",
    "bounded saved product wrapping",
)
tags = replace_once(
    tags,
    "      setState(() {\n        _applyServerDetail(detail);\n        _saving = false;\n      });\n      if (closeAfter && mounted) Navigator.of(context).pop(detail);",
    "      setState(() {\n        _applyServerDetail(detail);\n        _saving = false;\n      });\n      try {\n        widget.onSaved?.call(detail);\n      } catch (_) {\n        // The server write succeeded; presentation callbacks must not turn it\n        // into a false save failure.\n      }\n      if (closeAfter && mounted) Navigator.of(context).pop(detail);",
    "publish authoritative save to parent",
)
tags_path.write_text(tags)

chat_path = Path("android_app/lib/features/chat/chat_page.dart")
chat = chat_path.read_text()
helper = """  void _applyConversationTagsDetail(ConversationDetail updated) {
    final current = _detail;
    if (!mounted || current == null) return;
    setState(() => _detail = current.copyWith(
          tags: updated.tags,
          customerSalesInformation: updated.customerSalesInformation,
          purchaseInformation: updated.purchaseInformation,
          operationalState: updated.operationalState,
          unreadCount: updated.unreadCount,
          bmReplyStatus: updated.bmReplyStatus,
        ));
  }

"""
chat = replace_once(
    chat,
    "  Future<void> _showConversationTags() async {\n",
    helper + "  Future<void> _showConversationTags() async {\n",
    "chat parent apply helper",
)
chat = replace_once(
    chat,
    "    final detail = _detail;\n    if (detail == null || !mounted) return;\n    final sheetResult = await ConversationTagsSheet.show(",
    "    final detail = _detail;\n    if (detail == null || !mounted) return;\n    final wasInterested =\n        detail.customerSalesInformation?.isInterested == true;\n    final sheetResult = await ConversationTagsSheet.show(",
    "capture pre-sheet conversion state",
)
chat = replace_once(
    chat,
    "      initialSalesInfo: detail.customerSalesInformation,\n      initialPurchaseInfo: detail.purchaseInformation,\n    );",
    "      initialSalesInfo: detail.customerSalesInformation,\n      initialPurchaseInfo: detail.purchaseInformation,\n      onSaved: _applyConversationTagsDetail,\n    );",
    "wire sheet save callback",
)
chat = replace_once(
    chat,
    "    final wasInterested =\n        _detail?.customerSalesInformation?.isInterested == true;\n    final isNowPurchased =\n        updated.customerSalesInformation?.isPurchased == true;",
    "    final isNowPurchased =\n        updated.customerSalesInformation?.isPurchased == true;",
    "use captured conversion state",
)
old_apply = """    setState(() => _detail = _detail!.copyWith(
          tags: updated.tags,
          customerSalesInformation: updated.customerSalesInformation,
          purchaseInformation: updated.purchaseInformation,
          operationalState: updated.operationalState,
          unreadCount: updated.unreadCount,
          bmReplyStatus: updated.bmReplyStatus,
        ));"""
chat = replace_once(
    chat,
    old_apply,
    "    _applyConversationTagsDetail(updated);",
    "reuse parent apply helper",
)
chat_path.write_text(chat)

test_path = Path("android_app/test/tagging_test.dart")
tests = test_path.read_text()
marker = "saved sales summary stays readable on 360px Thai layout"
if marker in tests:
    raise SystemExit("tagging regression tests already present unexpectedly")
if not tests.rstrip().endswith("}"):
    raise SystemExit("tagging_test.dart does not end with main closing brace")
addition = r'''

  testWidgets('saved sales summary stays readable on 360px Thai layout',
      (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    const sales = CustomerSalesInformation(
      status: 'PURCHASED',
      purchaseChannel: ['STORE'],
      paymentMethod: 'INSTALLMENT',
      products: [
        CustomerSalesProductItem(
          id: 'summary-product',
          productModelId: 'summary-model',
          productVariantId: 'summary-variant',
          modelName: 'OPPO Reno16 Pro 5G',
          seriesName: 'Reno16',
          category: 'SMARTPHONE',
          ram: '12',
          rom: '512',
          color: 'Pearl White',
          quantity: 1,
          status: 'PURCHASED',
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(
      locale: const Locale('th'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: Column(
          children: [
            ConversationTagsBar(
              customerSalesInformation: sales,
              onPressed: () {},
            ),
            const Expanded(child: SizedBox.shrink()),
          ],
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(
      tester.getSize(
        find.byKey(const ValueKey('conversation-tags-leading-slot')),
      ).width,
      20,
    );
    expect(
      tester.getSize(find.byKey(const ValueKey('conversation-tags-content')))
          .width,
      greaterThan(220),
    );
    final productSummary = tester.widget<Text>(
      find.textContaining('OPPO Reno16 Pro 5G'),
    );
    expect(productSummary.maxLines, 2);
    expect(productSummary.softWrap, isTrue);
    expect(productSummary.overflow, TextOverflow.ellipsis);
    expect(tester.takeException(), isNull);
  });

  testWidgets('successful product save publishes server detail before dismissal',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = _FakeTagRepository();
    ConversationDetail? published;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ConversationTagsSheet(
          conversationId: 'conversation-parent-state',
          repository: repository,
          initialTags: const ConversationTags(),
          onSaved: (detail) => published = detail,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Purchased'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('+ Add Product').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('OPPO Reno16 Pro 5G').last);
    await tester.pumpAndSettle();
    await tester.tap(
      find.widgetWithText(ChoiceChip, '○ 12GB RAM · 256GB ROM · Graphite'),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm Selection'));
    await tester.pumpAndSettle();

    expect(repository.saveCallCount, 1);
    expect(published?.customerSalesInformation?.status, 'PURCHASED');
    expect(published?.customerSalesInformation?.products.single.modelName,
        'OPPO Reno16 Pro 5G');
    expect(find.text('Tagging'), findsOneWidget);
  });
'''
stripped = tests.rstrip()
test_path.write_text(stripped[:-1] + addition + "\n}\n")
