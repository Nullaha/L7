import {
  AttributeType,
  gl,
  IAnimateOption,
  IEncodeFeature,
  ILayerConfig,
  IModel,
  IModelUniform,
  ITexture2D,
} from '@antv/l7-core';
import { rgb2arr } from '@antv/l7-utils';
import BaseModel from '../../core/BaseModel';
import { ShaderLocation } from '../../core/CommonStyleAttribute';
import { ILineLayerStyleOptions } from '../../core/interface';
import { LineArcTriangulation } from '../../core/triangulation';
import line_arc_frag from '../shaders/line_arc_great_circle_frag.glsl';
import line_arc2d_vert from '../shaders/line_arc_great_circle_vert.glsl';
const lineStyleObj: { [key: string]: number } = {
  solid: 0.0,
  dash: 1.0,
};

// 这是一个 AntV L7 库的自定义图层模型，用于渲染大圆弧线
export default class GreatCircleModel extends BaseModel {
  protected texture: ITexture2D;
  public getUninforms(): IModelUniform {
    // 返回模型的 Uniform 变量，这些变量在顶点和片段着色器中使用。
    // 如线型、虚线设置、线贴图、渐变色等信息

    const {
      sourceColor,
      targetColor,
      textureBlend = 'normal',
      lineType = 'solid',
      dashArray = [10, 5],
      lineTexture = false,
      iconStep = 100,
      segmentNumber = 30,
    } = this.layer.getLayerConfig() as Partial<ILineLayerStyleOptions>;
    if (dashArray.length === 2) {
      dashArray.push(0, 0);
    }

    if (this.rendererService.getDirty()) {
      this.texture.bind();
    }

    // 转化渐变色
    let useLinearColor = 0; // 默认不生效
    let sourceColorArr = [0, 0, 0, 0];
    let targetColorArr = [0, 0, 0, 0];
    if (sourceColor && targetColor) {
      sourceColorArr = rgb2arr(sourceColor);
      targetColorArr = rgb2arr(targetColor);
      useLinearColor = 1;
    }

    return {
      u_textureBlend: textureBlend === 'normal' ? 0.0 : 1.0,
      segmentNumber,
      u_line_type: lineStyleObj[lineType as string] || 0.0,
      u_dash_array: dashArray,

      // 纹理支持参数
      u_texture: this.texture, // 贴图
      u_line_texture: lineTexture ? 1.0 : 0.0, // 传入线的标识
      u_icon_step: iconStep,
      u_textSize: [1024, this.iconService.canvasHeight || 128],

      // 渐变色支持参数
      u_linearColor: useLinearColor,
      u_sourceColor: sourceColorArr,
      u_targetColor: targetColorArr,
      ...this.getStyleAttribute()
    };
  }
  public getAnimateUniforms(): IModelUniform {
    const { animateOption } = this.layer.getLayerConfig() as ILayerConfig;
    return {
      u_animate: this.animateOption2Array(animateOption as IAnimateOption),
      u_time: this.layer.getLayerAnimateTime(),
    };
  }

  public async initModels(): Promise<IModel[]> {
    this.updateTexture();
    this.iconService.on('imageUpdate', this.updateTexture);

    return this.buildModels();
  }

  public clearModels() {
    this.texture?.destroy();
    this.iconService.off('imageUpdate', this.updateTexture);
  }
  public async buildModels(): Promise<IModel[]> {
    // 用于创建图层模型
    // 使用了自定义的顶点着色器和片段着色器，以及三角剖分方法 LineArcTriangulation。
    const { segmentNumber = 30 } =
    this.layer.getLayerConfig() as ILineLayerStyleOptions;
    const model = await this.layer.buildLayerModel({
      moduleName: 'lineGreatCircle',
      vertexShader: line_arc2d_vert,
      fragmentShader: line_arc_frag,
      triangulation: LineArcTriangulation,
      styleOption:{segmentNumber},
      inject:this.getInject(),
      depth: { enable: false },
    });
    return [model];
  }
  protected registerBuiltinAttributes() {
    // 注册一些内置的样式属性，如大小、实例信息、UV 坐标等。
    this.styleAttributeService.registerStyleAttribute({
      // size 属性表示弧线的宽度，实际上是线的高度
      name: 'size',
      type: AttributeType.Attribute,
      descriptor: {
        name: 'a_Size',
        buffer: {
          // give the WebGL driver a hint that this buffer may change
          usage: gl.DYNAMIC_DRAW,
          data: [],
          type: gl.FLOAT,
        },
        size: 1,
        update: (feature: IEncodeFeature) => {
          const { size = 1 } = feature;
          return Array.isArray(size) ? [size[0]] : [size as number];
        },
      },
    });

    this.styleAttributeService.registerStyleAttribute({
      // instance 属性表示弧线的起始点信息
      name: 'instance', // 弧线起始点信息
      type: AttributeType.Attribute,
      descriptor: {
        name: 'a_Instance',
        buffer: {
          usage: gl.STATIC_DRAW,
          data: [],
          type: gl.FLOAT,
        },
        size: 4,
        update: (
          feature: IEncodeFeature,
          featureIdx: number,
          vertex: number[],
        ) => {
          return [vertex[3], vertex[4], vertex[5], vertex[6]];
        },
      },
    });

    this.styleAttributeService.registerStyleAttribute({
      // uv 属性表示贴图的 UV 坐标
      name: 'uv',
      type: AttributeType.Attribute,
      descriptor: {
        name: 'a_iconMapUV',
        buffer: {
          // give the WebGL driver a hint that this buffer may change
          usage: gl.DYNAMIC_DRAW,
          data: [],
          type: gl.FLOAT,
        },
        size: 2,
        update: (feature: IEncodeFeature) => {
          const iconMap = this.iconService.getIconMap();
          const { texture } = feature;
          // console.log('icon feature', feature)
          const { x, y } = iconMap[texture as string] || { x: 0, y: 0 };
          return [x, y];
        },
      },
    });
  }

  private updateTexture = () => {
    // 更新纹理贴图，通常是将 Canvas 上的图像更新到纹理上
    const { createTexture2D } = this.rendererService;
    if (this.texture) {
      this.texture.update({
        data: this.iconService.getCanvas(),
      });
      this.layer.render();
      return;
    }
    this.texture = createTexture2D({
      data: this.iconService.getCanvas(),
      mag: gl.NEAREST,
      min: gl.NEAREST,
      premultiplyAlpha: false,
      width: 1024,
      height: this.iconService.canvasHeight || 128,
    });
  };
}
