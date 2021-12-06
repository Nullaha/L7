import { AttributeType, gl, IEncodeFeature, IModel } from '@antv/l7-core';
import { rgb2arr } from '@antv/l7-utils';
import { isNumber } from 'lodash';
import BaseModel, { styleOffset, styleSingle } from '../../core/BaseModel';
import { PointExtrudeTriangulation } from '../../core/triangulation';
import { lglt2xyz } from '../../earth/utils';
import { calculateCentroid } from '../../utils/geo';
import pointExtrudeFrag from '../shaders/extrude_frag.glsl';
import pointExtrudeVert from '../shaders/extrude_vert.glsl';
interface IPointLayerStyleOptions {
  depth: boolean;
  opacity: styleSingle;
  offsets: styleOffset;

  sourceColor?: string; // 可选参数、设置渐变色的起始颜色(all)
  targetColor?: string; // 可选参数、设置渐变色的终点颜色(all)
  opacityLinear?: {
    enable: boolean;
    dir: string;
  };

  lightEnable: boolean;
}
export default class ExtrudeModel extends BaseModel {
  public getUninforms() {
    const {
      opacity = 1,

      sourceColor,
      targetColor,

      opacityLinear = {
        enable: false,
        dir: 'up',
      },

      lightEnable = true,
    } = this.layer.getLayerConfig() as IPointLayerStyleOptions;
    if (
      this.dataTextureTest &&
      this.dataTextureNeedUpdate({
        opacity,
      })
    ) {
      this.judgeStyleAttributes({
        opacity,
      });
      const encodeData = this.layer.getEncodedData();
      const { data, width, height } = this.calDataFrame(
        this.cellLength,
        encodeData,
        this.cellProperties,
      );
      this.rowCount = height; // 当前数据纹理有多少行

      this.dataTexture =
        this.cellLength > 0 && data.length > 0
          ? this.createTexture2D({
              flipY: true,
              data,
              format: gl.LUMINANCE,
              type: gl.FLOAT,
              width,
              height,
            })
          : this.createTexture2D({
              flipY: true,
              data: [1],
              format: gl.LUMINANCE,
              type: gl.FLOAT,
              width: 1,
              height: 1,
            });
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
      // TODO: 判断当前的点图层的模型是普通地图模式还是地球模式
      u_globel: this.mapService.version === 'GLOBEL' ? 1 : 0,

      u_dataTexture: this.dataTexture, // 数据纹理 - 有数据映射的时候纹理中带数据，若没有任何数据映射时纹理是 [1]
      u_cellTypeLayout: this.getCellTypeLayout(),
      // u_opacity: opacity || 1.0,
      // u_offsets: offsets || [0, 0],
      u_opacity: isNumber(opacity) ? opacity : 1.0,

      // 渐变色支持参数
      u_linearColor: useLinearColor,
      u_sourceColor: sourceColorArr,
      u_targetColor: targetColorArr,

      // 透明度渐变
      u_opacitylinear: Number(opacityLinear.enable),
      u_opacitylinear_dir: opacityLinear.dir === 'up' ? 1.0 : 0.0,

      // 光照计算开关
      u_lightEnable: Number(lightEnable),
    };
  }
  public initModels(): IModel[] {
    return this.buildModels();
  }

  public buildModels(): IModel[] {
    // GAODE1.x GAODE2.x MAPBOX
    const {
      depth = true,
    } = this.layer.getLayerConfig() as IPointLayerStyleOptions;
    return [
      this.layer.buildLayerModel({
        moduleName: 'pointExtrude2',
        vertexShader: pointExtrudeVert,
        fragmentShader: pointExtrudeFrag,
        triangulation: PointExtrudeTriangulation,
        blend: this.getBlend(),
        cull: {
          enable: true,
          face: this.mapService.version === 'MAPBOX' ? gl.FRONT : gl.BACK,
        },
        depth: {
          enable: depth,
        },
        // primitive: gl.POINTS,
      }),
    ];
  }
  public clearModels() {
    this.dataTexture?.destroy();
  }
  protected registerBuiltinAttributes() {
    // TODO: 判断当前的点图层的模型是普通地图模式还是地球模式
    const isGlobel = this.mapService.version === 'GLOBEL';
    // point layer size;
    this.styleAttributeService.registerStyleAttribute({
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
        size: 3,
        update: (
          feature: IEncodeFeature,
          featureIdx: number,
          vertex: number[],
          attributeIdx: number,
        ) => {
          const { size } = feature;
          if (size) {
            let buffersize: number[] = [];
            if (Array.isArray(size)) {
              buffersize =
                size.length === 2 ? [size[0], size[0], size[1]] : size;
            }
            if (!Array.isArray(size)) {
              buffersize = [size, size, size];
            }
            return buffersize;
          } else {
            return [2, 2, 2];
          }
        },
      },
    });

    // point layer size;
    this.styleAttributeService.registerStyleAttribute({
      name: 'normal',
      type: AttributeType.Attribute,
      descriptor: {
        name: 'a_Normal',
        buffer: {
          // give the WebGL driver a hint that this buffer may change
          usage: gl.STATIC_DRAW,
          data: [],
          type: gl.FLOAT,
        },
        size: 3,
        update: (
          feature: IEncodeFeature,
          featureIdx: number,
          vertex: number[],
          attributeIdx: number,
          normal: number[],
        ) => {
          return normal;
        },
      },
    });
    this.styleAttributeService.registerStyleAttribute({
      name: 'pos',
      type: AttributeType.Attribute,
      descriptor: {
        name: 'a_Pos',
        buffer: {
          // give the WebGL driver a hint that this buffer may change
          usage: gl.DYNAMIC_DRAW,
          data: [],
          type: gl.FLOAT,
        },
        size: 3,
        update: (feature: IEncodeFeature, featureIdx: number) => {
          const coordinates = calculateCentroid(feature.coordinates);
          if (isGlobel) {
            // TODO: 在地球模式下需要将传入 shader 的经纬度转化成对应的 xyz 坐标
            return lglt2xyz([coordinates[0], coordinates[1]]) as [
              number,
              number,
              number,
            ];
          } else {
            return [coordinates[0], coordinates[1], 0];
          }
        },
      },
    });
  }
}
