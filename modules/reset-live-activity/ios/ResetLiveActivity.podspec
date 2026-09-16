Pod::Spec.new do |s|
  s.name           = 'ResetLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Reset Window Live Activity'
  s.description    = 'Starts, updates and ends the Reset Window Live Activity from JS. The widget extension that draws it lives in targets/reset-window.'
  s.author         = ''
  s.homepage       = 'https://reset.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
