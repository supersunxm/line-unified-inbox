import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/localization/localization.dart';

class InboxSearchField extends StatelessWidget {
  const InboxSearchField({
    super.key,
    required this.controller,
    required this.query,
    required this.onChanged,
    required this.onClear,
    this.autofocus = false,
    this.asButton = false,
    this.onTap,
  });

  final TextEditingController controller;
  final String query;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;
  final bool autofocus;
  final bool asButton;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 5),
        child: SizedBox(
          height: 40,
          child: asButton
              ? InkWell(
                  onTap: onTap,
                  borderRadius: BorderRadius.circular(10),
                  child: Row(
                    children: [
                      const SizedBox(width: 11),
                      const Icon(Icons.search,
                          size: 19, color: AppColors.textSecondary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          appLocalizations(context).searchConversations,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      const Icon(Icons.tune_rounded,
                          size: 18, color: AppColors.textSecondary),
                      const SizedBox(width: 11),
                    ],
                  ),
                )
              : TextField(
                  controller: controller,
                  autofocus: autofocus,
                  onChanged: onChanged,
                  textInputAction: TextInputAction.search,
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                    hintText: appLocalizations(context).searchConversations,
                    hintStyle: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                    ),
                    prefixIcon: const Icon(Icons.search, size: 19),
                    prefixIconConstraints:
                        const BoxConstraints(minWidth: 36, minHeight: 36),
                    suffixIcon: query.isEmpty
                        ? null
                        : IconButton(
                            onPressed: onClear,
                            tooltip: appLocalizations(context).clearSearch,
                            icon: const Icon(Icons.close, size: 17),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(
                                minWidth: 34, minHeight: 34),
                          ),
                    filled: true,
                    fillColor: AppColors.surfaceMuted,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(
                          color: AppColors.primary, width: 1.2),
                    ),
                  ),
                ),
        ),
      );
}
