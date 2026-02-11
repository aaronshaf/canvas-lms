/*
 * Copyright (C) 2011 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

// Ignored rules can be removed incrementally
// Resolving all these up-front is untenable and unlikely

/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('calculator.command')

interface Token {
  token: string
  value: string
  newIndex: number
}

interface Expression {
  regex: RegExp
  token: string
}

interface ExpressionTree {
  token: string
  value?: string | number
  newIndex: number
  expressionItems?: any[]
  variable?: Token
  assignmentExpression?: ExpressionTree
  expression?: ExpressionTree
  arguments?: ExpressionTree[]
  calculatedValue?: number
  computedValue?: number
}

interface ComputeResult {
  command: string
  syntax: Token[]
  tree: ExpressionTree
  computedValue: number
}

interface CalcFunction {
  (...args: any[]): number | number[]
  friendlyName?: string
  description?: string
  examples?: string[]
}

const calcCmd: {
  clearMemory: () => void
  compute: (command: string) => ComputeResult
  computeValue: (command: string) => number
  addFunction: (
    methodName: string,
    method: CalcFunction,
    description?: string,
    examples?: string | string[]
  ) => boolean
  addPredefinedVariable: (variableName: string, value: number, description?: string) => void
  functionDescription: (method: string) => string
  functionExamples: (method: string) => string[]
  functionList: () => [string, string][]
} = {} as any

;(function () {
  const methods: Record<string, CalcFunction> = {}
  const predefinedVariables: Record<string, number> = {}
  let variables: Record<string, number> = {}
  let lastComputedResult: number | undefined
  const expressions: Expression[] = [
    {regex: /\s+/, token: 'whitespace'},
    {regex: /[a-zA-Z][a-zA-Z0-9_\.]*/, token: 'variable'},
    {regex: /[0-9]*\.?[0-9]+/, token: 'number'},
    {regex: /\+/, token: 'add'},
    {regex: /\-/, token: 'subtract'},
    {regex: /\*/, token: 'multiply'},
    {regex: /\//, token: 'divide'},
    {regex: /\(/, token: 'open_paren'},
    {regex: /\)/, token: 'close_paren'},
    {regex: /\,/, token: 'comma'},
    {regex: /\^/, token: 'power'},
    {regex: /\=/, token: 'equals'},
  ]
  const parseToken = function (command: string, index: number): Token | null {
    const value = command.substring(index)
    const item: Partial<Token> = {}
    for (const idx in expressions) {
      const expression = expressions[idx]
      const match = value.match(expression.regex)
      if (match && match[0] && value.indexOf(match[0]) === 0) {
        item.token = expression.token
        item.value = match[0]
        item.newIndex = index + match[0].length
        return item as Token
      }
    }
    return null
  }
  const parseSyntax = function (command: string): Token[] {
    let index = 0
    const result: Token[] = []
    while (index < command.length) {
      const item = parseToken(command, index)
      if (!item) {
        throw new Error('unrecognized token at ' + index)
      }
      index = item.newIndex
      result.push(item)
    }
    return result
  }
  let syntaxIndex = 0
  const parseArgument = function (syntax: Token[]): ExpressionTree {
    let result: ExpressionTree | null = null
    switch (syntax[syntaxIndex].token) {
      case 'number':
        result = syntax[syntaxIndex] as any
        break
      case 'subtract':
        if (
          syntax[syntaxIndex + 1] &&
          (syntax[syntaxIndex + 1].token === 'number' ||
            syntax[syntaxIndex + 1].token === 'variable')
        ) {
          syntax[syntaxIndex + 1].value = '-' + syntax[syntaxIndex + 1].value
          syntaxIndex++
          result = syntax[syntaxIndex] as any
        } else {
          throw new Error('expecting a number at ' + syntax[syntaxIndex].newIndex)
        }
        break
      case 'variable':
        if (syntax[syntaxIndex + 1] && syntax[syntaxIndex + 1].token === 'open_paren') {
          result = syntax[syntaxIndex] as any
          result.token = 'method'
          result.arguments = []
          let ender = 'comma'
          syntaxIndex += 2
          if (syntax[syntaxIndex].token === 'close_paren') {
            ender = 'close_paren'
            syntaxIndex++
          }
          while (ender === 'comma') {
            result.arguments.push(parseExpression(syntax, ['comma', 'close_paren']))
            ender = syntax[syntaxIndex].token
            syntaxIndex++
          }
          syntaxIndex--
          if (ender !== 'close_paren') {
            throw new Error('expecting close parenthesis at ' + syntax[syntaxIndex].newIndex)
          }
        } else {
          result = syntax[syntaxIndex] as any
        }
        break
      case 'open_paren':
        result = syntax[syntaxIndex] as any
        result.token = 'parenthesized_expression'
        syntaxIndex++
        result.expression = parseExpression(syntax, ['close_paren'])
        break
    }
    if (!result) {
      const index = (syntax && syntax[syntaxIndex] && syntax[syntaxIndex].newIndex) || 0
      const type = (syntax && syntax[syntaxIndex] && syntax[syntaxIndex].token) || 'nothing'
      throw new Error('expecting a value at ' + index + ', got a ' + type)
    }
    syntaxIndex++
    return result
  }
  const parseModifier = function (syntax: Token[]): Token {
    switch (syntax[syntaxIndex].token) {
      case 'add':
        return syntax[syntaxIndex++]
      case 'subtract':
        return syntax[syntaxIndex++]
      case 'multiply':
        return syntax[syntaxIndex++]
      case 'divide':
        return syntax[syntaxIndex++]
      case 'power':
        return syntax[syntaxIndex++]
    }
    const value = (syntax && syntax[syntaxIndex] && syntax[syntaxIndex].token) || 'value'
    const index = (syntax && syntax[syntaxIndex] && syntax[syntaxIndex].newIndex) || 0
    throw new Error('unexpected ' + value + ' at ' + index)
  }

  const parseExpression = function (syntax: Token[], enders: string[]): ExpressionTree {
    const result: ExpressionTree = {
      token: 'expression',
      newIndex: syntax[syntaxIndex].newIndex,
    }
    result.expressionItems = []
    result.expressionItems.push(parseArgument(syntax))
    if (syntaxIndex > syntax.length) {
      return result
    }
    let ended = false
    while (syntaxIndex < syntax.length && !ended) {
      for (const idx in enders) {
        if (syntax[syntaxIndex].token === enders[idx]) {
          ended = true
        }
      }
      if (!ended) {
        result.expressionItems.push(parseModifier(syntax))
        result.expressionItems.push(parseArgument(syntax))
      }
    }
    return result
  }
  const parseFullExpression = function (syntax: Token[]): ExpressionTree {
    const newSyntax: Token[] = []
    for (const idx in syntax) {
      if (syntax[idx].token !== 'whitespace') {
        newSyntax.push(syntax[idx])
      }
    }
    syntax = newSyntax
    let result: ExpressionTree | null = null
    syntaxIndex = 0
    if (
      syntax[syntaxIndex].token === 'variable' &&
      syntax.length > 1 &&
      syntax[syntaxIndex + 1].token === 'equals'
    ) {
      result = {
        token: 'variable_assignment',
        newIndex: syntax[syntaxIndex].newIndex,
      }
      result.variable = syntax[syntaxIndex]
      if (syntax.length > 2) {
        syntaxIndex = 2
        result.assignmentExpression = parseExpression(syntax, [])
      } else {
        throw new Error('Expecting value at ' + syntax[syntaxIndex + 1].newIndex)
      }
    } else {
      result = parseExpression(syntax, [])
    }
    return result
  }
  const computeExpression = function (tree: ExpressionTree): number {
    const round0 = tree.expressionItems!
    const round1 = [round0[0]]
    for (let idx = 1; idx < round0.length; idx += 2) {
      const item = round0[idx]
      if (item.token === 'power') {
        const left = round1.pop()!
        const right = round0[idx + 1]
        round1.push(numberItem(Math.pow(compute(left), compute(right))))
      } else {
        round1.push(round0[idx])
        round1.push(round0[idx + 1])
      }
    }
    const round2 = [round1[0]]
    for (let idx = 1; idx < round1.length; idx += 2) {
      const item = round1[idx]
      if (item.token === 'multiply') {
        const left = round2.pop()!
        const right = round1[idx + 1]
        round2.push(numberItem(compute(left) * compute(right)))
      } else if (item.token === 'divide') {
        const left = round2.pop()!
        const right = round1[idx + 1]
        round2.push(numberItem(compute(left) / compute(right)))
      } else {
        round2.push(round1[idx])
        round2.push(round1[idx + 1])
      }
    }
    const round3 = [round2[0]]
    for (let idx = 1; idx < round2.length; idx += 2) {
      const item = round2[idx]
      if (item.token === 'add') {
        const left = round3.pop()!
        const right = round2[idx + 1]
        round3.push(numberItem(compute(left) + compute(right)))
      } else if (item.token === 'subtract') {
        const left = round3.pop()!
        const right = round2[idx + 1]
        round3.push(numberItem(compute(left) - compute(right)))
      } else {
        round3.push(round2[idx])
        round3.push(round2[idx + 1])
      }
    }
    if (round3.length === 0) {
      throw new Error('expressions should have at least one value')
    } else if (round3.length > 1) {
      throw new Error('unexpected modifier: ' + round3[1].token)
    } else {
      return compute(round3[0])
    }
  }
  const numberItem = function (number: number): ExpressionTree {
    return {
      token: 'number',
      value: number,
      calculatedValue: number,
      newIndex: 0,
    }
  }
  const compute = function (tree: ExpressionTree): number {
    switch (tree.token) {
      case 'number':
        return parseFloat(tree.value as string)
      case 'expression':
        return computeExpression(tree)
      case 'parenthesized_expression':
        return compute(tree.expression!)
      case 'variable_assignment':
        if (tree.variable!.value === '_') {
          throw new Error("the variable '_' is reserved")
        }
        variables[tree.variable!.value] = compute(tree.assignmentExpression!)
        return variables[tree.variable!.value]
      case 'variable':
        if (tree.value === '_') {
          return lastComputedResult || 0
        }
        if ((tree.value as string).indexOf('-') === 0) {
          // the variable is negative, e.g. '-x'
          const absolute = (tree.value as string).replace(/^\-/, '')
          let value = predefinedVariables && predefinedVariables[absolute]
          value = value || (variables && variables[absolute])
          value = -value
        } else {
          var value = predefinedVariables && predefinedVariables[tree.value as string]
          value = value || (variables && variables[tree.value as string])
        }
        if (value === undefined) {
          throw new Error('undefined variable ' + tree.value)
        }
        return value
      case 'method':
        const args: number[] = []
        for (const idx in tree.arguments) {
          const value = compute(tree.arguments[idx])
          tree.arguments[idx].computedValue = value
          args.push(value)
        }
        if (methods[tree.value as string]) {
          return methods[tree.value as string].apply(null, args) as number
        } else {
          throw new Error('unrecognized method ' + tree.value)
        }
    }
    throw new Error('Unexpected token type: ' + tree.token)
  }
  calcCmd.clearMemory = function () {
    variables = {}
    lastComputedResult = undefined
  }
  const cached_trees: Record<string, ComputeResult> = {}
  calcCmd.compute = function (command: string): ComputeResult {
    const result: Partial<ComputeResult> = {}
    command = command.toString()
    result.command = command
    const tree = cached_trees[command]
    if (tree) {
      result.syntax = tree.syntax
      result.tree = tree.tree
    } else {
      result.syntax = parseSyntax(command)
      result.tree = parseFullExpression(result.syntax)
      cached_trees[command] = result as ComputeResult
    }
    result.computedValue = compute(result.tree)
    lastComputedResult = result.computedValue
    return result as ComputeResult
  }
  calcCmd.computeValue = function (command: string): number {
    return calcCmd.compute(command).computedValue
  }
  const isFunction = function (arg: any): boolean {
    return true
  }
  calcCmd.addFunction = function (
    methodName: string,
    method: CalcFunction,
    description?: string,
    examples?: string | string[]
  ): boolean {
    if (typeof methodName === 'string' && isFunction(method)) {
      method.friendlyName = methodName
      method.description = description
      if (typeof examples === 'string') {
        examples = [examples]
      }
      method.examples = examples
      methods[methodName] = method
      return true
    }
    return false
  }
  calcCmd.addPredefinedVariable = function (
    variableName: string,
    value: number,
    description?: string
  ): void {
    value = parseFloat(value as any)
    if (typeof variableName === 'string' && (value || value === 0)) {
      predefinedVariables[variableName] = value
    }
  }
  calcCmd.functionDescription = function (method: string): string {
    if (methods[method]) {
      return (
        methods[method].description ||
        I18n.t('no_description', 'No description found for the function, %{functionName}', {
          functionName: method,
        })
      )
    } else {
      return I18n.t('unrecognized', '%{functionName} is not a recognized function', {
        functionName: method,
      })
    }
  }
  calcCmd.functionExamples = function (method: string): string[] {
    if (methods[method]) {
      return methods[method].examples || []
    } else {
      return []
    }
  }
  calcCmd.functionList = function (): [string, string][] {
    const result: [string, string][] = []
    for (const idx in methods) {
      const method = methods[idx]
      result.push([
        idx,
        method.description || I18n.t('default_description', 'No description given'),
      ])
    }
    result.sort(function (a, b) {
      if (a[0] > b[0]) {
        return 1
      } else if (a[0] < b[0]) {
        return -1
      } else {
        return 0
      }
    })
    return result
  }
})()
;(function () {
  const p = function (name: string, value: number, description?: string) {
    calcCmd.addPredefinedVariable(name, value, description)
  }
  const f = function (
    name: string,
    func: CalcFunction,
    description: string,
    example: string | string[]
  ) {
    calcCmd.addFunction(name, func, description, example)
  }

  p('pi', Math.PI)
  p('e', Math.exp(1))

  f(
    'abs',
    function (val: number) {
      return Math.abs(val)
    },
    I18n.t('abs.description', 'Returns the absolute value of the given value'),
    'abs(x)'
  )
  f(
    'asin',
    function (x: number) {
      return Math.asin(x)
    },
    I18n.t('asin.description', 'Returns the arcsin of the given value'),
    'asin(x)'
  )
  f(
    'acos',
    function (x: number) {
      return Math.acos(x)
    },
    I18n.t('acos.description', 'Returns the arccos of the given value'),
    'acos(x)'
  )
  f(
    'atan',
    function (x: number) {
      return Math.atan(x)
    },
    I18n.t('atan.description', 'Returns the arctan of the given value'),
    'atan(x)'
  )
  f(
    'log',
    function (x: number, base?: number) {
      return Math.log(x) / Math.log(base || 10)
    },
    I18n.t('log.description', 'Returns the log of the given value with an optional base'),
    'log(x, [base])'
  )
  f(
    'ln',
    function (x: number) {
      return Math.log(x)
    },
    I18n.t('ln.description', 'Returns the natural log of the given value'),
    'ln(x)'
  )
  f(
    'rad_to_deg',
    function (x: number) {
      return (x * 180) / Math.PI
    },
    I18n.t('rad_to_deg.description', 'Returns the given value converted from radians to degrees'),
    'rad_to_deg(radians)'
  )
  f(
    'deg_to_rad',
    function (x: number) {
      return (x * Math.PI) / 180
    },
    I18n.t('deg_to_rad.description', 'Returns the given value converted from degrees to radians'),
    'deg_to_rad(degrees)'
  )
  f(
    'sin',
    function (x: number) {
      return Math.sin(x)
    },
    I18n.t('sin.description', 'Returns the sine of the given value'),
    'sin(radians)'
  )
  f(
    'cos',
    function (x: number) {
      return Math.cos(x)
    },
    I18n.t('cos.description', 'Returns the cosine of the given value'),
    'cos(radians)'
  )
  f(
    'tan',
    function (x: number) {
      return Math.tan(x)
    },
    I18n.t('tan.description', 'Returns the tangent of the given value'),
    'tan(radians)'
  )

  f(
    'sec',
    function (x: number) {
      return 1 / Math.cos(x)
    },
    I18n.t('sec.description', 'Returns the secant of the given value'),
    'sec(radians)'
  )
  f(
    'cosec',
    function (x: number) {
      return 1 / Math.sin(x)
    },
    I18n.t('cosec.description', 'Returns the cosecant of the given value'),
    'cosec(radians)'
  )
  f(
    'cotan',
    function (x: number) {
      return 1 / Math.tan(x)
    },
    I18n.t('cotan.description', 'Returns the cotangent of the given value'),
    'cotan(radians)'
  )

  f(
    'pi',
    function (x: number) {
      return Math.PI
    },
    I18n.t('pi.description', 'Returns the computed value of pi'),
    'pi()'
  )
  f(
    'if',
    function (bool: any, pass: number, fail: number) {
      return bool ? pass : fail
    },
    I18n.t(
      'if.description',
      'Evaluates the first argument, returns the second argument if it evaluates to a non-zero value, otherwise returns the third value'
    ),
    'if(bool,success,fail)'
  )
  const make_list = function (args: IArguments | number[]): number[] {
    if (args.length === 1 && args[0] instanceof Array) {
      return args[0]
    } else {
      return Array.from(args) as number[]
    }
  }
  f(
    'max',
    function () {
      const args = make_list(arguments)
      let max = args[0]
      for (let idx = 0; idx < args.length; idx++) {
        // in arguments) {
        max = Math.max(max, args[idx])
      }
      return max
    },
    I18n.t('max.description', 'Returns the highest value in the list'),
    ['max(a,b,c...)', 'max(list)']
  )
  f(
    'min',
    function () {
      const args = make_list(arguments)
      let min = args[0]
      for (let idx = 0; idx < args.length; idx++) {
        // in arguments) {
        min = Math.min(min, args[idx])
      }
      return min
    },
    I18n.t('min.description', 'Returns the lowest value in the list'),
    ['min(a,b,c...)', 'min(list)']
  )
  f(
    'sqrt',
    function (x: number) {
      return Math.sqrt(x)
    },
    I18n.t('sqrt.description', 'Returns the square root of the given value'),
    'sqrt(x)'
  )
  f(
    'sort',
    function () {
      const args = make_list(arguments)
      const list: number[] = []
      for (let idx = 0; idx < args.length; idx++) {
        list.push(args[idx])
      }
      return list.sort(function (a, b) {
        return a - b
      })
    },
    I18n.t('sort.description', 'Returns the list of values, sorted from lowest to highest'),
    ['sort(a,b,c...)', 'sort(list)']
  )
  f(
    'reverse',
    function () {
      const args = make_list(arguments)
      const list: number[] = []
      for (let idx = 0; idx < args.length; idx++) {
        list.unshift(args[idx])
      }
      return list
    },
    I18n.t('reverse.description', 'Reverses the order of the list of values'),
    ['reverse(a,b,c...)', 'reverse(list)']
  )
  f(
    'first',
    function () {
      return make_list(arguments)[0]
    },
    I18n.t('first.description', 'Returns the first value in the list'),
    ['first(a,b,c...)', 'first(list)']
  )
  f(
    'last',
    function () {
      const args = make_list(arguments)
      return args[args.length - 1]
    },
    I18n.t('last.description', 'Returns the last value in the list'),
    ['last(a,b,c...)', 'last(list)']
  )
  f(
    'at',
    function (list: number[], x: number) {
      return list[x]
    },
    I18n.t('at.description', 'Returns the indexed value in the given list'),
    'at(list,index)'
  )
  f(
    'rand',
    function (x?: number) {
      return Math.random() * (x || 1)
    },
    I18n.t(
      'rand.description',
      'Returns a random number between zero and the range specified, or one if no number is given'
    ),
    'rand(x)'
  )
  f(
    'length',
    function () {
      return make_list(arguments).length
    },
    I18n.t('length.description', 'Returns the number of arguments in the given list'),
    ['length(a,b,c...)', 'length(list)']
  )
  const sum = function (list: number[]): number {
    let total = 0
    for (let idx = 0; idx < list.length; idx++) {
      // in list) {
      if (list[idx]) {
        total += list[idx]
      }
    }
    return total
  }
  f(
    'mean',
    function () {
      const args = make_list(arguments)
      return sum(args) / args.length
    },
    I18n.t('mean.description', 'Returns the average mean of the values in the list'),
    ['mean(a,b,c...)', 'mean(list)']
  )
  f(
    'median',
    function () {
      const args = make_list(arguments)
      let list: number[] = []
      for (let idx = 0; idx < args.length; idx++) {
        list.push(args[idx])
      }
      list = list.sort(function (a, b) {
        return parseFloat(a as any) - parseFloat(b as any)
      })
      if (list.length % 2 === 1) {
        return list[Math.floor(list.length / 2)]
      } else {
        return (list[Math.round(list.length / 2)] + list[Math.round(list.length / 2) - 1]) / 2
      }
    },
    I18n.t('median.description', 'Returns the median for the list of values'),
    ['median(a,b,c...)', 'median(list)']
  )
  f(
    'range',
    function () {
      const args = make_list(arguments)
      let list: number[] = []
      for (let idx = 0; idx < args.length; idx++) {
        list.push(args[idx])
      }
      list = list.sort((a, b) => a - b)
      return list[list.length - 1] - list[0]
    },
    I18n.t('range.description', 'Returns the range for the list of values'),
    ['range(a,b,c...)', 'range(list)']
  )
  f(
    'count',
    function () {
      return make_list(arguments).length
    },
    I18n.t('count.description', 'Returns the number of items in the list'),
    ['count(a,b,c...)', 'count(list)']
  )
  f(
    'sum',
    function () {
      return sum(make_list(arguments))
    },
    I18n.t('sum.description', 'Returns the sum of the list of values'),
    ['sum(a,b,c...)', 'sum(list)']
  )
  const factorials: Record<number, number> = {}
  const fact = function (n: number): number {
    n = Math.max(parseInt(n as any, 10), 0)
    if (n === 0 || n === 1) {
      return 1
    } else if (n > 170) {
      return Infinity
    } else if (factorials[n]) {
      return factorials[n]
    } else {
      return n * fact(n - 1)
    }
  }
  f(
    'fact',
    function (n: number) {
      return fact(n)
    },
    I18n.t('fact.description', 'Returns the factorial of the given number'),
    'fact(n)'
  )
  f(
    'perm',
    function (n: number, k: number) {
      return fact(n) / fact(n - k)
    },
    I18n.t('perm.description', 'Returns the permutation result for the given values'),
    'perm(n, k)'
  )
  f(
    'comb',
    function (n: number, k: number) {
      return fact(n) / (fact(k) * fact(n - k))
    },
    I18n.t('comb.description', 'Returns the combination result for the given values'),
    'comb(n, k)'
  )
  f(
    'ceil',
    function (x: number) {
      return Math.ceil(x)
    },
    I18n.t('ceil.description', 'Returns the ceiling for the given value'),
    'ceil(x)'
  )
  f(
    'floor',
    function (x: number) {
      return Math.floor(x)
    },
    I18n.t('floor.description', 'Returns the floor for the given value'),
    'floor(x)'
  )
  f(
    'round',
    function (x: number) {
      return Math.round(x)
    },
    I18n.t('round.description', 'Returns the given value rounded to the nearest whole number'),
    'round(x)'
  )
  f(
    'e',
    function (x?: number) {
      return Math.exp(x || 1)
    },
    I18n.t('e.description', 'Returns the value for e'),
    'e()'
  )
})()

export default calcCmd
