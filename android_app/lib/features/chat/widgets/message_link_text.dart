import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/localization/localization.dart';

final _messageUrlPattern = RegExp(
  r'(?:(?:https?://)|(?:www\.))[^\s<]+|(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\.)+[a-z]{2,}(?:/[^\s<]*)?',
  caseSensitive: false,
);

class MessageLinkText extends StatefulWidget {
  const MessageLinkText({super.key, required this.text});

  final String text;

  @override
  State<MessageLinkText> createState() => _MessageLinkTextState();
}

class _MessageLinkTextState extends State<MessageLinkText> {
  late List<MessageLinkPart> _parts;
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void initState() {
    super.initState();
    _parts = parseMessageLinks(widget.text);
  }

  @override
  void didUpdateWidget(covariant MessageLinkText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text != widget.text) {
      _disposeRecognizers();
      _parts = parseMessageLinks(widget.text);
    }
  }

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  void _disposeRecognizers() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();
  }

  Future<void> _open(String rawUrl) async {
    final normalized = rawUrl.toLowerCase().startsWith('http://') ||
            rawUrl.toLowerCase().startsWith('https://')
        ? rawUrl
        : 'https://$rawUrl';
    final uri = Uri.tryParse(normalized);
    final launched = uri != null &&
        (uri.scheme == 'http' || uri.scheme == 'https') &&
        await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(appLocalizations(context).unableToOpenLink)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    _disposeRecognizers();
    final baseStyle = DefaultTextStyle.of(context).style;
    final spans = <InlineSpan>[];
    for (final part in _parts) {
      if (!part.isLink) {
        spans.add(TextSpan(text: part.text));
        continue;
      }
      final recognizer = TapGestureRecognizer()
        ..onTap = () => unawaited(_open(part.text));
      _recognizers.add(recognizer);
      spans.add(TextSpan(
        text: part.text,
        recognizer: recognizer,
        style: baseStyle.copyWith(
          color: Theme.of(context).colorScheme.primary,
          decoration: TextDecoration.underline,
        ),
      ));
    }
    return Text.rich(TextSpan(style: baseStyle, children: spans));
  }
}

class MessageLinkPart {
  const MessageLinkPart(this.text, this.isLink);

  final String text;
  final bool isLink;
}

List<MessageLinkPart> parseMessageLinks(String text) {
  final parts = <MessageLinkPart>[];
  var cursor = 0;
  for (final match in _messageUrlPattern.allMatches(text)) {
    if (match.start > cursor) {
      parts.add(MessageLinkPart(text.substring(cursor, match.start), false));
    }
    final raw = match.group(0)!;
    final link = _trimTrailingPunctuation(raw);
    if (link.isEmpty) {
      parts.add(MessageLinkPart(raw, false));
    } else {
      parts.add(MessageLinkPart(link, true));
      if (link.length < raw.length) {
        parts.add(MessageLinkPart(raw.substring(link.length), false));
      }
    }
    cursor = match.end;
  }
  if (cursor < text.length) {
    parts.add(MessageLinkPart(text.substring(cursor), false));
  }
  if (parts.isEmpty) parts.add(MessageLinkPart(text, false));
  return parts;
}

String _trimTrailingPunctuation(String value) {
  var end = value.length;
  while (end > 0 && '.,!?;:'.contains(value[end - 1])) {
    end -= 1;
  }
  while (end > 0 &&
      value[end - 1] == ')' &&
      _count(value.substring(0, end), ')') >
          _count(value.substring(0, end), '(')) {
    end -= 1;
  }
  while (end > 0 && ']}'.contains(value[end - 1])) {
    end -= 1;
  }
  return value.substring(0, end);
}

int _count(String value, String character) =>
    character.allMatches(value).length;
