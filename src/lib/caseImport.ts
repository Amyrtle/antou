import { caseToDataset, type ExperimentCase } from './caseLibrary'
import { useData } from '../store/data'
import { useHistory } from '../store/history'
import { useUi } from '../store/ui'
import { useWindows } from '../store/windows'
import { usePipeline, focusDataset } from '../store/pipeline'

/** 把一个实例库案例抄成数据表、生成报表，并在数据表窗口里打开 */
export function importCase(c: ExperimentCase): string {
  const ds = caseToDataset(c)
  const id = useData.getState().addDataset(ds)
  useData.getState().generateReport(id)

  // 流水线布局：直接切到写轨道；独立窗口模式下才复用/新建表窗口
  if (usePipeline.getState().layout === 'pipeline') {
    focusDataset(id)
  } else {
    useWindows.getState().open('table', '数据表', { payload: { datasetId: id } })
  }

  useUi.getState().setStage('write')
  useUi.getState().noteAction(`已抄入案例：${c.name}（${ds.rows.length} 行）`)
  useHistory.getState().log({
    kind: 'edit',
    title: `实例库导入：${c.name}`,
    detail: `${ds.rows.length} 行 × ${ds.columns.length} 列`,
  })
  return id
}

export function openCasesWindow() {
  // 实例库本身也复用：同一个库没必要开两个窗口
  useWindows.getState().open('cases', '实例库')
  useUi.getState().setStage('write')
}
