import type { Plugin, Chart } from "chart.js";

const chartStates = new Map();

type HitBoxMeta = {
    left: number;
    top: number;
    width: number;
    height: number;
    text: string;
}

class ChartLegendManager {
    hitBoxes: HitBoxMeta[] = [];

    focusBoxMargin: number;

    focusBox: HTMLDivElement;

    chart: Chart;

    canvas: Chart["canvas"];

    constructor(chart: Chart, startingMargin: number = 0){
        this.focusBoxMargin = startingMargin;
        this.chart = chart;
        this.canvas = chart.canvas;
        this.focusBox = this._generateFocusBox();
        this.chart.canvas.insertAdjacentElement("afterend", this.focusBox);
    }
    
    suppressFocusBox = () => {
        this.focusBox.setAttribute("tabIndex", "-1");
    }

    reviveFocusBox = () => {
        this.focusBox.setAttribute("tabIndex", "0");
    }

    private _generateFocusBox = () => {
        const focusBox = document.createElement("div");
        focusBox.setAttribute("tabIndex", "0");
        focusBox.setAttribute("data-legend-index", "0");
        focusBox.setAttribute("role", "option");
        focusBox.setAttribute("aria-selected", "true");
        focusBox.style.position = "absolute";
        
        const hideFocusBox = () => {
            focusBox.style.left = "-1000px";
        }
        
        const keyboardNavigation = (e: KeyboardEvent) => {
            const index = Number(focusBox.getAttribute("data-legend-index"));
            const maxIndex = this.hitBoxes.length - 1;
            if(e.key === "ArrowRight"){
                e.preventDefault();
                e.stopPropagation();
                if(index >= maxIndex){
                    return;
                }
                focusBox.setAttribute("data-legend-index", String(index+1));
                moveFocusBox();
                return;
            }
            if(e.key === "ArrowLeft"){
                e.preventDefault();
                e.stopPropagation();
                if(index <= 0){
                    return;
                }
                focusBox.setAttribute("data-legend-index", String(index-1));
                moveFocusBox();
                return;
            }
            if(e.key === " " || e.key === "Enter"){
                if(["pie", "doughnut"].includes(this.chart.config.type)){
                    this.chart.toggleDataVisibility(index);
                    const isVisible = this.chart.getDataVisibility(index);
                    focusBox.setAttribute("aria-selected", String(isVisible));
                }else{
                    if(this.chart.isDatasetVisible(index)){
                        this.chart.hide(index);
                        focusBox.setAttribute("aria-selected", "false");
                    }else{
                        this.chart.show(index);
                        focusBox.setAttribute("aria-selected", "true");
                    }
                }
                this.chart.update();
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        const moveFocusBox = () => {
            const index = Number(focusBox.getAttribute("data-legend-index"));
            if(isNaN(index)){
                return;
            }

            const bbox = this.canvas.getBoundingClientRect();
            const {left, top, width, height, text} = this.hitBoxes[index];

            focusBox.style.left = `${bbox.x + left - this.focusBoxMargin - window.pageXOffset}px`;
            focusBox.style.top = `${bbox.y + top - this.focusBoxMargin + window.pageYOffset}px`;
            focusBox.style.width = `${width + (2*this.focusBoxMargin)}px`;
            focusBox.style.height = `${height + (2*this.focusBoxMargin)}px`;
            focusBox.setAttribute("aria-label", `${text}, ${index+1} of ${this.hitBoxes.length}`);
        }

        hideFocusBox();

        focusBox.addEventListener("focus", moveFocusBox);
        focusBox.addEventListener("blur", hideFocusBox);
        focusBox.addEventListener("keydown", keyboardNavigation);

        return focusBox;
    }
}

const updateForLegends = (chart: Chart, manager: ChartLegendManager) => {
    const {legend} = chart;
        
    if(!legend?.legendItems){
        return manager.suppressFocusBox();
    }

    manager.hitBoxes = legend?.legendItems?.map(({text}, index) => {
        return {
            // @ts-ignore
            ...(legend.legendHitBoxes?.[index] ?? {}),
            text
        }
    }) ?? [];
    
}


const plugin: Plugin = {
    id: "a11y_legend",

    afterInit: (chart: Chart, args, options) => {
        const manager = new ChartLegendManager(chart, options.margin);
        chartStates.set(chart, manager);
        updateForLegends(chart, manager);
    },

    beforeDraw: (chart, args, options) => {
        const manager = chartStates.get(chart);
        if(!chart.options.plugins?.legend?.display){
            return manager.suppressFocusBox();
        }
        manager.reviveFocusBox();
        manager.focusBoxMargin = options.margin;
        updateForLegends(chart, manager);
    },

    afterDestroy(chart: Chart) {
      chartStates.delete(chart);
    },

    defaults: {
        margin: 4
    }

};

export default plugin;