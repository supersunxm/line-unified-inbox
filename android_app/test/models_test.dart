import 'package:flutter_test/flutter_test.dart';
import 'package:line_oa_chat_hub/core/models/models.dart';
import 'package:line_oa_chat_hub/features/inbox/conversation_repository.dart';

void main() {
  test('conversation summary maps unread badge and preview', () {
    final item = ConversationSummary.fromJson({
      'id': 'conversation-1',
      'customer': {'displayName': 'Customer'},
      'store': {'name': 'Store'},
      'unreadCount': 2,
      'bmReplyStatus': 'NOT_REPLIED',
      'lastMessage': {
        'preview': 'Hello',
        'direction': 'INBOUND',
        'messageType': 'TEXT',
        'sentAt': '2026-08-11T00:00:00.000Z'
      },
    });
    expect(item.unreadCount, 2);
    expect(item.preview, 'Hello');
  });

  test('conversation summary prefixes outbound text preview', () {
    final item = ConversationSummary.fromJson({
      'id': 'conversation-1',
      'customer': {'displayName': 'Customer'},
      'store': {'name': 'Store'},
      'unreadCount': 0,
      'bmReplyStatus': 'REPLIED',
      'lastMessage': {
        'preview': 'Thank you',
        'direction': 'OUTBOUND',
        'messageType': 'TEXT',
        'sentAt': '2026-08-11T00:00:00.000Z'
      },
    });
    expect(item.preview, 'You: Thank you');
  });

  test('conversation summary uses direction-aware image preview', () {
    ConversationSummary summary(String direction) =>
        ConversationSummary.fromJson({
          'id': 'conversation-$direction',
          'customer': {'displayName': 'Customer'},
          'store': {'name': 'Store'},
          'unreadCount': 0,
          'bmReplyStatus': 'REPLIED',
          'lastMessage': {
            'preview': '[Image]',
            'direction': direction,
            'messageType': 'IMAGE',
            'sentAt': '2026-08-11T00:00:00.000Z'
          },
        });

    expect(summary('INBOUND').preview, 'Sent an image');
    expect(summary('OUTBOUND').preview, 'You: Sent an image');
  });

  test('conversation summary uses a non-empty video preview label', () {
    final item = ConversationSummary.fromJson({
      'id': 'conversation-video',
      'customer': {'displayName': 'Customer'},
      'store': {'name': 'Store'},
      'unreadCount': 0,
      'bmReplyStatus': 'NOT_REPLIED',
      'lastMessage': {
        'preview': '[Video]',
        'direction': 'INBOUND',
        'messageType': 'VIDEO',
        'sentAt': '2026-08-11T00:00:00.000Z'
      },
    });
    expect(item.preview, 'Sent a video');
  });

  test('conversation detail maps customer, store, timestamps, and ready media',
      () {
    final detail = ConversationDetail.fromJson({
      'id': 'conversation-1',
      'customer': {'displayName': 'Somchai'},
      'store': {'id': 'store-1', 'name': 'OBS Bangkae', 'code': '30194'},
      'messages': [
        {
          'id': 'message-1',
          'direction': 'INBOUND',
          'messageType': 'IMAGE',
          'text': '[Image]',
          'sentAt': '2026-08-13T02:12:00.000Z',
          'sender': {'userId': 'bm-1', 'displayName': 'Sunn'},
          'media': {
            'processingStatus': 'READY',
            'mimeType': 'image/jpeg',
            'fileSize': 123,
            'url': '/messages/message-1/media'
          },
        },
      ],
    });
    expect(detail.customerName, 'Somchai');
    expect(detail.storeName, 'OBS Bangkae');
    expect(detail.storeCode, '30194');
    expect(detail.messages.single.sentAt,
        DateTime.parse('2026-08-13T02:12:00.000Z'));
    expect(detail.messages.single.media?.ready, isTrue);
    expect(detail.messages.single.media?.url, '/messages/message-1/media');
    expect(detail.messages.single.sender?.displayName, 'Sunn');
  });

  test('missing or malformed media is safe and text remains available', () {
    final message = ChatMessage.fromJson({
      'id': 'message-1',
      'direction': 'INBOUND',
      'messageType': 'TEXT',
      'text': 'Hello',
      'sentAt': '2026-08-13T02:12:00.000Z',
      'media': {'processingStatus': null, 'fileSize': 'invalid'}
    });
    expect(message.text, 'Hello');
    expect(message.media?.processingStatus, 'FAILED');
    expect(message.media?.fileSize, isNull);
    expect(message.media?.ready, isFalse);
    expect(message.sender, isNull);
  });

  test('conversation detail recognizes ready video media', () {
    final message = ChatMessage.fromJson({
      'id': 'video-message',
      'direction': 'INBOUND',
      'messageType': 'VIDEO',
      'text': '[Video]',
      'sentAt': '2026-08-13T02:12:00.000Z',
      'media': {
        'processingStatus': 'READY',
        'mimeType': 'video/mp4',
        'fileSize': 4096,
        'url': '/messages/video-message/media'
      },
    });
    expect(message.media?.isVideo, isTrue);
    expect(message.media?.ready, isTrue);
    expect(message.media?.url, '/messages/video-message/media');
  });

  test('conversation detail maps manual tags only', () {
    final detail = ConversationDetail.fromJson({
      'id': 'conversation-1',
      'customer': {'displayName': 'Customer'},
      'store': {'name': 'Store'},
      'tags': {
        'sourceChannel': 'STORE',
        'product': {
          'id': 'model-1',
          'productName': 'OPPO Reno16 Pro 5G',
          'category': 'SMARTPHONE',
          'seriesName': 'Reno16',
        },
      },
      'messages': [],
    });
    expect(detail.tags?.sourceChannels, ['STORE']);
    expect(detail.tags?.product?.productName, 'OPPO Reno16 Pro 5G');
  });

  test('conversation detail parses separated purchase and insight contracts',
      () {
    final detail = ConversationDetail.fromJson({
      'id': 'conversation-1',
      'customer': {'displayName': 'Customer'},
      'store': {'name': 'Store'},
      'purchaseInformation': {
        'recordState': 'VERIFIED',
        'purchaseChannel': ['STORE'],
        'paymentMethod': 'INSTALLMENT',
        'recordedBy': 'BM Tester',
        'recordedAt': '2026-08-16T10:00:00.000Z',
        'products': [
          {
            'model': {'id': 'model-1', 'name': 'OPPO Find N6'},
            'variant': {'id': 'variant-1', 'color': 'Titanium'},
            'source': 'MANUAL',
          }
        ],
      },
      'aiInsight': {
        'mentionedProducts': [],
        'topics': [
          {'id': 'topic-1', 'name': 'Price Inquiry', 'category': 'SALES'}
        ],
        'classification': {'purchaseIntent': 'High Intent'},
      },
      'operationalState': {
        'replyStatus': 'NOT_REPLIED',
        'priority': {'level': 'HIGH'},
        'unread': 1,
      },
      'messages': [],
    });
    expect(detail.purchaseInformation?.recordState, 'VERIFIED');
    expect(detail.purchaseInformation?.paymentMethod, 'INSTALLMENT');
    expect(detail.purchaseInformation?.recordedBy, 'BM Tester');
    expect(detail.purchaseInformation?.recordedAt?.toUtc().toIso8601String(),
        '2026-08-16T10:00:00.000Z');
    expect(detail.purchaseInformation?.products.single['source'], 'MANUAL');
    expect(detail.aiInsight?.topics.single['name'], 'Price Inquiry');
    expect(detail.operationalState?.priority, 'HIGH');
  });
}
