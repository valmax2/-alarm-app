import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:alarm_app/main.dart';

void main() {
  testWidgets('AlarmDemoApp shows the alarm ring screen', (WidgetTester tester) async {
    // The screen is designed for a tall phone viewport; use one instead of
    // the default test surface so the layout doesn't overflow.
    tester.view.physicalSize = const Size(480, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const AlarmDemoApp());

    expect(find.text('Sveglia Mattutina'), findsOneWidget);
  });
}
