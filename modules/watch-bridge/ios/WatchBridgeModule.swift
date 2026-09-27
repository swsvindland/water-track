import ExpoModulesCore

public class WatchBridgeModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events("onQueue")

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: WatchBridge.queueChanged,
        object: nil,
        queue: nil
      ) { [weak self] _ in
        self?.sendEvent("onQueue")
      }
    }

    OnStopObserving {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
      }
      self.observer = nil
    }

    Function("updateState") { (json: String) in
      WatchBridge.shared.updateState(json)
    }

    Function("queuedDrinks") { () -> String in
      WatchBridge.shared.queuedJSON()
    }

    Function("removeQueuedDrinks") { (ids: [String]) in
      WatchBridge.shared.remove(ids)
    }
  }
}
