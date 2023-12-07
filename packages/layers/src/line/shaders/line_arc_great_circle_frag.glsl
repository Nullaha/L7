#version 300 es
// 片段着色器：主要负责绘制弧线时设置颜色、动画效果和贴图
#define LineTypeSolid 0.0
#define LineTypeDash 1.0 //虚线
#define Animate 0.0 //动画
#define LineTexture 1.0


// in vec2 v_normal;
layout(location = 0) in vec4 v_dash_array;
layout(location = 1) in float v_distance_ratio;
layout(location = 2) in vec4 v_color; // 颜色
layout(location = 3) in vec2 v_iconMapUV; //贴图设置：
layout(location = 4) in vec4 v_line_data;

layout(std140) uniform commonUniforms {

  float u_textureBlend; // 颜色叠加模式：叠加模式，是使用普通模式 (normal) 还是替换模式 (replace)。
  float u_blur : 0.9;
  float u_line_type: 0.0; //虚线设置：如果是虚线类型1，通过 discard 语句来丢弃虚线部分，实线部分正常绘制。


  float u_time;
  vec4 u_animate: [ 1., 2., 1.0, 0.2 ]; // 动画设置：通过它来控制弧线的动画效果

  float u_line_texture: 0.0; //贴图设置：是否是开启状态
  sampler2D u_texture; //贴图设置：如果是启用状态，通过它来获取弧线的贴图。
  vec2 u_textSize; //贴图设置：
  float segmentNumber;



  float u_linearColor: 0; // 颜色设置： 来判断是否使用渐变颜色 1使用，0不使用
  vec4 u_sourceColor;
  vec4 u_targetColor;
}


out vec4 outputColor;

#pragma include "picking"
#pragma include "project"
#pragma include "projection"

void main() {

  float animateSpeed = 0.0;
  float d_segmentIndex = v_line_data.g;

  // 设置弧线的底色
  if(u_linearColor == 1.0) { // 使用渐变颜色：通过 mix 函数混合 u_sourceColor 和 u_targetColor
    outputColor = mix(u_sourceColor, u_targetColor, d_segmentIndex/segmentNumber);
     outputColor.a *= v_color.a;
  } else { // 使用 color 方法传入的颜色
     outputColor = v_color;
  }

  // float blur = 1.- smoothstep(u_blur, 1., length(v_normal.xy));
  // float blur = smoothstep(1.0, u_blur, length(v_normal.xy));
  if(u_line_type == LineTypeDash) {
    float dashLength = mod(v_distance_ratio, v_dash_array.x + v_dash_array.y + v_dash_array.z + v_dash_array.w);
    if(dashLength < v_dash_array.x || (dashLength > (v_dash_array.x + v_dash_array.y) && dashLength <  v_dash_array.x + v_dash_array.y + v_dash_array.z)) {
      // 实线部分
    } else {
      // 虚线部分
      discard;
    };
  }

  // 设置弧线的动画模式
  if(u_animate.x == Animate) { //使用 fract 函数和 smoothstep 函数来实现动画的渐变效果。
      animateSpeed = u_time / u_animate.y;
      float alpha =1.0 - fract( mod(1.0- v_distance_ratio, u_animate.z)* (1.0/ u_animate.z) + u_time / u_animate.y);
      alpha = (alpha + u_animate.w -1.0) / u_animate.w;
      alpha = smoothstep(0., 1., alpha);
      outputColor.a *= alpha;
  }

  // 设置弧线的贴图
  if(LineTexture == u_line_texture && u_line_type != LineTypeDash) {
    float arcRadio = smoothstep( 0.0, 1.0, (d_segmentIndex / (segmentNumber - 1.0)));
    // float arcRadio = d_segmentIndex / (segmentNumber - 1.0);
    float count = v_line_data.b; // 贴图在弧线上重复的数量
    float u = fract(arcRadio * count - animateSpeed * count);
    // float u = fract(arcRadio * count - animateSpeed);
    if(u_animate.x == Animate) {
      u = outputColor.a/v_color.a;
    }

    float v = v_line_data.a; // 线图层贴图部分的 v 坐标值

    vec2 uv= v_iconMapUV / u_textSize + vec2(u, v) / u_textSize * 64.;
    vec4 pattern = texture(u_texture, uv);

    // 设置贴图和底色的叠加模式
    if(u_textureBlend == 0.0) { // normal
      pattern.a = 0.0;
      outputColor = filterColor(outputColor + pattern);
    } else { // replace
        pattern.a *= v_color.a;
        if(outputColor.a <= 0.0) {
          pattern.a = 0.0;
        }
        outputColor = filterColor(pattern);
    }
  } else {
    outputColor = filterColor(outputColor);
  }

  // outputColor = filterColor(outputColor);
}
