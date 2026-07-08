import ExpoModulesCore

// Exposes build-environment facts that only native code can answer.
//
// `isTestFlight` is derived from the App Store receipt: TestFlight (and dev)
// installs carry a `sandboxReceipt`, while an App Store install carries a
// production `receipt`. TestFlight and the App Store ship the *same* binary,
// so this receipt check is the only reliable runtime way to tell them apart.
public class BuildEnvModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BuildEnv")

    Constants([
      "isTestFlight": BuildEnvModule.isSandboxReceipt()
    ])
  }

  private static func isSandboxReceipt() -> Bool {
    guard let url = Bundle.main.appStoreReceiptURL else { return false }
    return url.lastPathComponent == "sandboxReceipt"
  }
}
