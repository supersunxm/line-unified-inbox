import '../../../core/models/models.dart';

/// The presentation groups used by the Customer Sales product picker.
///
/// These are deliberately client-side groups. The catalog's persisted
/// `category`, `seriesName`, and `productName` remain the source of truth and
/// are never rewritten by the picker.
enum ProductPickerCategory { all, smartphone, tablet, watch, audio, iot }

enum ProductPickerSeries { all, find, reno, aSeries }

ProductPickerCategory classifyProductCategory(ProductSelectorItem product) {
  final category = _normalize(product.category);
  final series = _normalize(product.seriesName);
  final name = _normalize(product.productName);
  final haystack = '$category $series $name';

  // Check the more specific device families first. This also handles legacy
  // rows whose product group was left as UNKNOWN but whose name is clear.
  if (_containsAny(haystack, const [
    'TABLET',
    'PAD',
  ])) {
    return ProductPickerCategory.tablet;
  }
  if (_containsAny(haystack, const [
    'WATCH',
    'WEARABLE',
    'SMARTWATCH',
  ])) {
    return ProductPickerCategory.watch;
  }
  if (_containsAny(haystack, const [
    'AUDIO',
    'EARPHONE',
    'EARBUD',
    'HEADPHONE',
    'ENCO',
  ])) {
    return ProductPickerCategory.audio;
  }

  if (_containsAny(haystack, const [
        'SMARTPHONE',
        'PHONE',
        'FOLDABLE',
        'FIND',
        'RENO',
      ]) ||
      _looksLikeOppoSmartphone(name)) {
    return ProductPickerCategory.smartphone;
  }

  return ProductPickerCategory.iot;
}

ProductPickerSeries classifySmartphoneSeries(ProductSelectorItem product) {
  final series = _normalize(product.seriesName);
  final name = _normalize(product.productName);
  final haystack = '$series $name';
  if (haystack.contains('FIND')) return ProductPickerSeries.find;
  if (haystack.contains('RENO')) return ProductPickerSeries.reno;
  if (_looksLikeASeries(series) || _looksLikeASeries(name)) {
    return ProductPickerSeries.aSeries;
  }
  return ProductPickerSeries.all;
}

String _normalize(String value) => value.trim().toUpperCase();

bool _containsAny(String value, List<String> terms) =>
    terms.any(value.contains);

bool _looksLikeOppoSmartphone(String name) => RegExp(
        r'\bOPPO\s+(?:A\s*\d{1,3}|FIND\b|RENO\b|R\s*\d{1,3}|N\s*\d{1,3}|K\s*\d{1,3})')
    .hasMatch(name);

bool _looksLikeASeries(String value) =>
    RegExp(r'\bA\s*(?:-|シリーズ|SERIES)\b').hasMatch(value) ||
    RegExp(r'\b(?:OPPO\s+)?A\s*\d{1,3}(?:\s|$)').hasMatch(value);
