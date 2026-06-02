#import <GLKit/GLKit.h>
#import <QuartzCore/QuartzCore.h>

__attribute__((visibility("default")))
@interface ShenaiView : GLKViewController

- (void)resetRendererForSdkLifecycle;
- (void)releaseRendererForSdkLifecycle;

@end
