from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one exact match in {path}, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


def sub_once(path: str, pattern: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1)
    if count != 1:
        raise SystemExit(f"Expected one regex match in {path}, found {count}: {pattern[:100]!r}")
    p.write_text(updated)


replace_once(
    "backend/prisma/schema.prisma",
    "enum PaymentMethodType {\n  CASH\n  INSTALLMENT\n  CREDIT_CARD\n  OTHER\n}",
    "enum PaymentMethodType {\n  CASH\n  INSTALLMENT\n  CREDIT_CARD\n  UFUND\n  SG_FINANCE\n  OTHER\n}",
)

replace_once(
    "backend/src/line-chat-nickname.ts",
    'paymentMethod?: "CASH" | "INSTALLMENT" | "CREDIT_CARD" | "OTHER" | null;',
    'paymentMethod?: "CASH" | "INSTALLMENT" | "CREDIT_CARD" | "UFUND" | "SG_FINANCE" | "OTHER" | null;',
)
sub_once(
    "backend/src/line-chat-nickname.ts",
    r'''  const paymentLabel = input\.paymentMethod === "CASH"\s*\n\s*\? "สด"\s*\n\s*: input\.paymentMethod === "INSTALLMENT"\s*\n\s*\? "ผ่อน"\s*\n\s*: null;''',
    '''  const paymentLabel = input.paymentMethod === "CASH"\n    ? "สด"\n    : input.paymentMethod === "INSTALLMENT" || input.paymentMethod === "CREDIT_CARD"\n      ? "ผ่อน"\n      : input.paymentMethod === "UFUND"\n        ? "Ufund"\n        : input.paymentMethod === "SG_FINANCE"\n          ? "SG"\n          : null;''',
)

ui = "android_app/lib/features/chat/widgets/conversation_tags_sheet.dart"
replace_once(
    ui,
    "                                  'CREDIT_CARD' =>\n                                    '💳 ${appLocalizations(context).paymentCreditCard}',\n                                  'OTHER' =>",
    "                                  'CREDIT_CARD' =>\n                                    '💳 ${appLocalizations(context).paymentCreditCard}',\n                                  'UFUND' => '💳 Ufund',\n                                  'SG_FINANCE' => '💳 SG Finance',\n                                  'OTHER' =>",
)
replace_once(
    ui,
    "  bool get _hasValidFilmBrand {",
    "  bool get _isInstallmentPayment => const <String>{\n        'INSTALLMENT',\n        'CREDIT_CARD',\n        'UFUND',\n        'SG_FINANCE',\n      }.contains(_paymentMethod);\n\n  bool get _hasValidFilmBrand {",
)
replace_once(
    ui,
    "  void _setStatus(String? status) {",
    "  void _setInstallmentSelected(bool selected) {\n    setState(() {\n      if (selected) {\n        if (!_isInstallmentPayment) {\n          _paymentMethod = 'CREDIT_CARD';\n        }\n      } else if (_isInstallmentPayment) {\n        _paymentMethod = null;\n      }\n      _dirty = true;\n    });\n  }\n\n  void _setInstallmentProvider(String value, bool selected) {\n    if (!selected) return;\n    _setPaymentMethod(value, true);\n  }\n\n  void _setStatus(String? status) {",
)

old_payment_ui = """                        _choice(
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
                    const SizedBox(height: AppSpacing.lg),"""
new_payment_ui = """                        _choice(
                          'INSTALLMENT',
                          '💳 ${l10n.installment}',
                          _isInstallmentPayment,
                          _setInstallmentSelected,
                        ),
                        _choice(
                          'OTHER',
                          '🏷️ ${l10n.paymentOther}',
                          _paymentMethod == 'OTHER',
                          (selected) => _setPaymentMethod('OTHER', selected),
                        ),
                      ],
                    ),
                    if (_isInstallmentPayment) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Installment Type',
                        style: Theme.of(context)
                            .textTheme
                            .titleSmall
                            ?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.xs,
                        children: [
                          _choice(
                            'CREDIT_CARD',
                            '💳 ${l10n.paymentCreditCard}',
                            _paymentMethod == 'INSTALLMENT' ||
                                _paymentMethod == 'CREDIT_CARD',
                            (selected) => _setInstallmentProvider(
                                'CREDIT_CARD', selected),
                          ),
                          _choice(
                            'UFUND',
                            'Ufund',
                            _paymentMethod == 'UFUND',
                            (selected) =>
                                _setInstallmentProvider('UFUND', selected),
                          ),
                          _choice(
                            'SG_FINANCE',
                            'SG Finance',
                            _paymentMethod == 'SG_FINANCE',
                            (selected) => _setInstallmentProvider(
                                'SG_FINANCE', selected),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),"""
replace_once(ui, old_payment_ui, new_payment_ui)

test_path = "android_app/test/tagging_test.dart"
replace_once(
    test_path,
    """    await tester.tap(find.widgetWithText(FilterChip, '○ 🏪 Store'));
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 💳 Installment'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('+ Add Product').first);""",
    """    await tester.tap(find.widgetWithText(FilterChip, '○ 🏪 Store'));
    await tester.tap(find.widgetWithText(ChoiceChip, '○ 💳 Installment'));
    await tester.pumpAndSettle();

    expect(find.text('Installment Type'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, '✓ 💳 Credit Card'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, '○ Ufund'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, '○ SG Finance'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, '○ Ufund'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ChoiceChip, '✓ Ufund'), findsOneWidget);

    await tester.tap(find.text('+ Add Product').first);""",
)
replace_once(
    test_path,
    "    expect(repository.currentSales?.paymentMethod, 'INSTALLMENT');",
    "    expect(repository.currentSales?.paymentMethod, 'UFUND');",
)

migration = Path("backend/prisma/migrations/20260917043000_add_installment_finance_payment_methods/migration.sql")
migration.parent.mkdir(parents=True, exist_ok=True)
migration.write_text('''-- AlterEnum\nALTER TYPE "PaymentMethodType" ADD VALUE 'UFUND';\nALTER TYPE "PaymentMethodType" ADD VALUE 'SG_FINANCE';\n''')

Path("backend/src/line-chat-nickname.installment-finance.spec.ts").write_text('''import { describe, expect, it } from "vitest";\nimport { buildLineChatNickname } from "./line-chat-nickname";\n\nconst baseInput = {\n  status: "PURCHASED" as const,\n  recordedAt: new Date("2026-09-16T08:00:00.000Z"),\n  products: [{ model: { name: "OPPO A5" } }],\n};\n\ndescribe("LINE chat installment finance nickname labels", () => {\n  it("keeps legacy INSTALLMENT as credit-card installment", () => {\n    expect(buildLineChatNickname({ ...baseInput, paymentMethod: "INSTALLMENT" })).toBe("A5 ผ่อน 09/26");\n  });\n\n  it("maps explicit credit card to ผ่อน", () => {\n    expect(buildLineChatNickname({ ...baseInput, paymentMethod: "CREDIT_CARD" })).toBe("A5 ผ่อน 09/26");\n  });\n\n  it("maps Ufund to Ufund", () => {\n    expect(buildLineChatNickname({ ...baseInput, paymentMethod: "UFUND" })).toBe("A5 Ufund 09/26");\n  });\n\n  it("maps SG Finance to SG", () => {\n    expect(buildLineChatNickname({ ...baseInput, paymentMethod: "SG_FINANCE" })).toBe("A5 SG 09/26");\n  });\n});\n''')
