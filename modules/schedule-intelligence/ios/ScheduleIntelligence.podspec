Pod::Spec.new do |s|
  s.name           = 'ScheduleIntelligence'
  s.version        = '1.0.0'
  s.summary        = 'On-device Apple Intelligence schedule parsing'
  s.description    = 'Turns a description of a daily routine into a weekly wake-up and bedtime schedule with Apple Foundation Models.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
