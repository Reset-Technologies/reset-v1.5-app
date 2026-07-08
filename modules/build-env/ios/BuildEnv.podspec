Pod::Spec.new do |s|
  s.name           = 'BuildEnv'
  s.version        = '1.0.0'
  s.summary        = 'Build-environment facts (TestFlight detection)'
  s.description    = 'Exposes whether the running iOS binary was installed via TestFlight (sandbox receipt) vs the App Store.'
  s.author         = ''
  s.homepage       = 'https://reset.com'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
