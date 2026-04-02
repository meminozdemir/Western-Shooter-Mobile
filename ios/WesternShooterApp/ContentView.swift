import SwiftUI

struct ContentView: View {
    var body: some View {
        WebGameView()
            // Extend rendering edge-to-edge, covering the notch / Dynamic Island
            // and the rounded corners on all devices.
            .ignoresSafeArea()
            // iOS 16+: hide the Home Indicator so it doesn't overlap the game UI.
            .persistentSystemOverlays(.hidden)
    }
}

#Preview {
    ContentView()
}
